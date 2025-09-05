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
            required:true,      
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
        }

    },
    {
        timestamps:true
    }
)

module.exports=mongoose.model("Service", serviceSchema);
