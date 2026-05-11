var mongoose = require("mongoose");

var articles_schema = new mongoose.Schema({
    news_request_id:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'news_request',
    },
    source_id:{
        type: String,
        required: false
    },
    source_name:{
        type: String,
        required: false
    },
    author:{
        type: String,
        required: false
    },
    title: {
        type: String,
        required: false
    },
    description:{
        type: String,
        required: false
    },
    url:{
        type: String,
        required: false
    },
    url_to_image:{
        type: String,
        required: false
    },
    publish_date:{
        type: Date,
        required: false
    },
    content: {
        type: String,
        required: false
    }
});

var articles = mongoose.model("articles", articles_schema);
module.exports = articles;