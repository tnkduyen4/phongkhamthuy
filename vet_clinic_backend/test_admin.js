const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

async function checkAdmin() {
    await mongoose.connect(process.env.MONGO_URI);
    const admin = await User.findOne({role: 'ADMIN'});
    console.log(admin);
    process.exit(0);
}
checkAdmin();
