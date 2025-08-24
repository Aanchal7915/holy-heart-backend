const express=require('express');
const mongoose=require('mongoose');
const cors=require('cors');
const appointmentRoute=require('./routes/appointment');
const userRoute=require('./routes/user');
const authRoute=require('./routes/auth');
const dotenv=require('dotenv');
dotenv.config();


const app=express();

app.use(express.json());

app.use(cors({
  origin: "*", // frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"], // allowed methods
  credentials: true // allow cookies/auth headers if needed
}));

app.use('/appointments',appointmentRoute);
app.use('/user',userRoute);
app.use('/auth',authRoute);


app.get('/',(req,res)=>{
    res.send('Welcome to Holy Heart Backend');
});

const mongoDbUrl = process.env.MONGODB_URI;
mongoose.connect(mongoDbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(()=>{
    console.log('Connected to MongoDB');
}).catch((err)=>{
    console.error('Error connecting to MongoDB', err);
});

app.listen(8080, ()=>{
    console.log('Server started on port 8080');
});



