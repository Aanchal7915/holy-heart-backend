const express=require('express');
const mongoose=require('mongoose');
const cors=require('cors');
const appointmentRoute=require('./routes/appointment');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const userRoute=require('./routes/user');
const authRoute=require('./routes/auth');
const adminRoute=require('./routes/admin');
const serviceRoute=require('./routes/service');
const doctorRoute=require('./routes/doctor');
const paymentRoute=require("./routes/payment.js")
const path = require("path");
const dotenv=require('dotenv');
dotenv.config();


const app=express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(cors({
  origin: "*", // frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"], // allowed methods
  credentials: true // allow cookies/auth headers if needed
}));


app.use('/appointments',appointmentRoute);
app.use('/user',userRoute);
app.use('/auth',authRoute);
app.use("/admin", adminRoute);
app.use("/services", serviceRoute);
app.use("/doctors", doctorRoute);
app.use("/payments", paymentRoute);

// Swagger definition
const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'Holy Heart Backend API',
        version: '1.0.0',
        description: 'API documentation for Holy Heart Backend',
    },
    servers: [
        { url: 'http://localhost:3000', description: 'Local server' }
    ],
};

const swaggerOptions = {
    swaggerDefinition,
    apis: ['./routes/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

app.listen(8080, '0.0.0.0', ()=>{
    console.log('Server started on port 8080');
});



