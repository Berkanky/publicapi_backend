var express = require("express");
var app = express.Router();

var {
  ISSUER,
} = process.env;

if( !ISSUER ) throw new Error("Issuer required. ");

//Health service.
app.get(
    "/health",
    async(req, res) => { 
        try{
          return res.status(200).json({
            issuer: ISSUER,
            success: true,
            request_date: new Date()
          });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message: err, success: false });
        }
    }
);

module.exports = app;