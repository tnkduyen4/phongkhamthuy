const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const jwt = require('jsonwebtoken');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const Appointment = require('../models/Appointment');
const Pet = require('../models/Pet');
const User = require('../models/User');

const getRandomGenAI = () => {
    const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
    const keys = keysStr.split(',').map(k => k.trim()).filter(k => k);
    if (keys.length === 0) throw new Error("Missing Gemini API Key");
    const selectedKey = keys[Math.floor(Math.random() * keys.length)];
    return new GoogleGenerativeAI(selectedKey);
};

const tools = [{
  functionDeclarations: [{
    name: "book_appointment",
    description: "Hàm này được gọi khi khách hàng yêu cầu TẠO LỊCH HẸN KHÁM BỆNH HOẶC SPA. Cung cấp Tên thú cưng, ngày và giờ.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        pet_name: { type: SchemaType.STRING, description: "Tên thú cưng khách muốn đặt lịch" },
        type: { type: SchemaType.STRING, description: "Loại dịch vụ: Khám bệnh (MEDICAL) hoặc Cắt tỉa lông (GROOMING)" },
        date: { type: SchemaType.STRING, description: "Ngày hẹn định dạng YYYY-MM-DD" },
        time: { type: SchemaType.STRING, description: "Giờ hẹn (08:00 đến 18:00)" },
        reason: { type: SchemaType.STRING, description: "Lý do khám hoặc ghi chú của khách" }
      },
      required: ["pet_name", "date", "time", "reason", "type"]
    }
  }]
}];

const sendMessage = async (req, res) => {
  try {
    const { sessionId, message, isHumanRequest } = req.body;
    let currentSessionId = sessionId;
    let userId = null;
    let userPets = [];

    // 1. Phân tích Token để biết có phải là Khách hàng đã Đăng nhập không
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
        userPets = await Pet.find({ ownerId: userId, isActive: true });
      } catch (err) {
        console.warn("Invalid chat token:", err.message);
      }
    }

    // 2. Lấy hoặc Tạo phiên Chat (Chat Session)
    let session;
    if (currentSessionId) {
      session = await ChatSession.findById(currentSessionId);
    } 
    
    if (!session) {
      session = new ChatSession({
        userId: userId,
        status: 'active'
      });
      await session.save();
      currentSessionId = session._id;
    }

    // 3. Lưu tin nhắn người dùng vào DB
    const userMessage = new ChatMessage({
      sessionId: currentSessionId,
      sender: 'user',
      content: message
    });
    await userMessage.save();

    // 4. Kiểm tra yêu cầu chuyển người thật (Human Handoff)
    const isDemandingHuman = isHumanRequest || /(nhân viên|quản lý|người thật|gặp người|lễ tân)/i.test(message);

    if (isDemandingHuman && session.status !== 'human_intervention') {
      session.status = 'human_intervention';
      await session.save();
      
      const aiResponse = new ChatMessage({
         sessionId: currentSessionId,
         sender: 'ai',
         content: "Dạ, mình đã chuyển yêu cầu của bạn đến Lễ tân. Bạn vui lòng giữ màn hình, Lễ tân sẽ nhắn tin hỗ trợ trực tiếp ngay nhé!"
      });
      await aiResponse.save();
      return res.json({ response: aiResponse.content, sessionId: currentSessionId, status: session.status });
    }

    if (session.status === 'human_intervention') {
       return res.json({ 
          response: "Tin nhắn của bạn đã được chuyển cho Lễ tân, vui lòng đợi trong giây lát...", 
          sessionId: currentSessionId, 
          status: session.status 
       });
    }

    if (session.status === 'closed') {
        session.status = 'active'; // Reset if user chats again
        await session.save();
    }

    // 5. Chuẩn bị Context cho Gemini
    let SYSTEM_PROMPT = `Bạn là Bác sĩ Thú y AI và Lễ tân chuyên nghiệp của phòng khám thú y VetCare.
Bạn ĐƯỢC PHÉP TRẢ LỜI CÁC CÂU HỎI VỀ KIẾN THỨC THÚ Y, DẤU HIỆU BỆNH, VÀ CÁCH CHĂM SÓC THÚ CƯNG.
Hãy chẩn đoán sơ bộ dựa trên triệu chứng khách mô tả và đưa ra lời khuyên chăm sóc hữu ích. Luôn kèm theo lời khuyên nên đưa bé đến phòng khám nếu triệu chứng nặng hoặc kéo dài.
Trả lời NGẮN GỌN, SÚC TÍCH, THÂN THIỆN. Không dài dòng. Tối đa 3-4 câu.

`;

    if (userId) {
        SYSTEM_PROMPT += `Khách hàng này ĐÃ ĐĂNG NHẬP.
Thông tin thú cưng của khách hiện tại:
${userPets.length > 0 ? userPets.map(p => `- ID: ${p._id}, Tên: ${p.name}, Giới tính: ${p.gender}, Loài: ${p.species}`).join('\n') : "Khách chưa có thú cưng nào được lưu."}
Khi đặt lịch hẹn bằng hàm book_appointment, hãy đảm bảo khách chọn 1 trong các thú cưng trên. Nếu khách gọi tên thú cưng không có trong danh sách, hãy nhắc khách.
`;
    } else {
        SYSTEM_PROMPT += `Khách hàng này LÀ KHÁCH VÃNG LAI (CHƯA ĐĂNG NHẬP).
QUAN TRỌNG: Bạn KHÔNG THỂ gọi hàm book_appointment cho khách vãng lai. Nếu khách muốn đặt lịch, HÃY TỪ CHỐI GỌI HÀM và nhắn khách đăng nhập vào tài khoản trên website trước (yêu cầu bắt buộc).
`;
    }

    const history = await ChatMessage.find({ sessionId: currentSessionId }).sort({ createdAt: 1 }).limit(12);
    const contents = [];

    for (let msg of history) {
      if (msg.sender === 'user') {
        contents.push({ role: "user", parts: [{ text: msg.content }] });
      } else if (msg.sender === 'ai' && !msg.isFunctionCall) {
        contents.push({ role: "model", parts: [{ text: msg.content }] });
      }
    }

    // 6. Gửi tới Gemini API
    const genAI = getRandomGenAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      tools: tools,
    });

    const aiResponseRaw = await model.generateContent({ contents });
    const response = aiResponseRaw.response;
    const functionCalls = response.functionCalls();

    // 7. Xử lý khi Gemini trả về Function Call (Đặt lịch hẹn)
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      
      if (call.name === 'book_appointment' && userId) {
        const args = call.args;
        
        // Tìm thú cưng trong DB dựa trên tên
        const matchedPet = userPets.find(p => p.name.toLowerCase().includes((args.pet_name || "").toLowerCase()));
        
        if (!matchedPet) {
            const failMsg = new ChatMessage({
                sessionId: currentSessionId,
                sender: 'ai',
                content: `Mình không tìm thấy bé nào tên ${args.pet_name} trong hồ sơ của bạn. Bạn kiểm tra lại giúp mình nhé!`
            });
            await failMsg.save();
            return res.json({ response: failMsg.content, sessionId: currentSessionId, status: session.status });
        }

        // Lưu log gọi hàm
        const funcMessage = new ChatMessage({
          sessionId: currentSessionId,
          sender: 'ai',
          content: `Đang xử lý đặt lịch ${args.type === 'MEDICAL' ? 'khám bệnh' : 'grooming'} cho ${matchedPet.name}...`,
          isFunctionCall: true,
          functionData: args
        });
        await funcMessage.save();

        // Tạo Document Appointment thật sự vào DB
        const newAppointment = new Appointment({
           customerId: userId,
           petId: matchedPet._id,
           type: args.type || 'MEDICAL',
           category: 'REGULAR',
           bookingSource: 'CUSTOMER_APP',
           date: new Date(args.date),
           timeSlot: args.time,
           customerNotes: args.reason || '',
           status: 'BOOKED'
        });
        await newAppointment.save();

        const successMessage = new ChatMessage({
           sessionId: currentSessionId,
           sender: 'ai',
           content: `✅ Thành công! Mình đã chốt lịch ${args.type === 'MEDICAL' ? 'Khám sức khoẻ' : 'Grooming'} cho bé ${matchedPet.name} vào lúc ${args.time} ngày ${args.date}. Quý khách nhớ đưa bé đến đúng giờ nhé!\n\n[LINK_APPOINTMENT]`
        });
        await successMessage.save();

        return res.json({ response: successMessage.content, sessionId: currentSessionId, status: session.status });
      }
    }

    // 8. Gemini trả lời text bình thường
    let finalAnswer = "Dạ hệ thống hiện tại đang bị quá tải, bạn có thể thử lại sau một chút nhé.";
    try {
        finalAnswer = response.text() || finalAnswer;
    } catch(err) {
        console.error("Gemini no text output:", err);
    }
    
    const aiMessageDB = new ChatMessage({
      sessionId: currentSessionId,
      sender: 'ai',
      content: finalAnswer
    });
    await aiMessageDB.save();

    return res.json({ response: finalAnswer, sessionId: currentSessionId, status: session.status });

  } catch (error) {
    console.error("Chat Controller Error:", error);
    res.status(500).json({ error: "Lỗi kết nối bộ não AI." });
  }
};

const getHistory = async (req, res) => {
   try {
     const { sessionId } = req.query;
     if (!sessionId) return res.json([]);
     
     const history = await ChatMessage.find({ sessionId })
         .sort({ createdAt: 1 })
         .limit(50);
         
     res.json(history);
   } catch (error) {
     res.status(500).json({ error: "Lỗi tải lịch sử chat." });
   }
};

const getActiveSessions = async (req, res) => {
    try {
        const sessions = await ChatSession.find({ status: { $in: ['active', 'human_intervention'] } })
            .populate('userId', 'fullName avatar phoneNumber')
            .sort({ updatedAt: -1 });
        res.json({ success: true, data: sessions });
    } catch (e) { res.status(500).json({ success: false, error: "Lỗi Server" }); }
};

const staffReply = async (req, res) => {
    try {
        const { sessionId, message } = req.body;
        const msg = new ChatMessage({
            sessionId,
            sender: 'staff',
            content: message
        });
        await msg.save();
        
        await ChatSession.findByIdAndUpdate(sessionId, { status: 'human_intervention' });
        res.json({ success: true, response: msg });
    } catch (e) { res.status(500).json({ success: false, error: "Lỗi Server" }); }
};

const resolveSession = async (req, res) => {
    try {
        const { sessionId } = req.body;
        await ChatSession.findByIdAndUpdate(sessionId, { status: 'active' });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: "Lỗi Server" }); }
};

module.exports = {
  sendMessage,
  getHistory,
  getActiveSessions,
  staffReply,
  resolveSession
};
