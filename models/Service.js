const mongoose =require('mongoose')

const serviceSchema=new mongoose.Schema(
    {
        name:{
            type:String,
            required: true,
            trim:true
        },
        description:{
            type:String,     
            trim:true
        },
        status:{
            type:String,
            enum:['active','inactive', 'deleted'],
            default:'active'
        },
        image:{
            type:String,
            trim:true
        },
        type:{
            type:String,
            enum:['test','treatment', 'opds'],
            required:true,
            default:"treatment"
        },
        price:{
            type:Number,
            default:0
        },
        duration:{
            type:Number
        }

    },
    {
        timestamps:true
    }
)

module.exports=mongoose.model("Service", serviceSchema);
