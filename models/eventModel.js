var mongoose = require('mongoose')

// data 
var Schema = mongoose.Schema

var eventSchema = new Schema({
    event: {
        name: String,
        location: String,
        presenter: String,
        notes: String,
    },
    feedback: {
        starRating: Number,
        engaging: Number,
        inspiring: Number,
        informative: Number,
        notes: String
    }
})


// person schema for mongo 
var event = mongoose.model('Event', eventSchema)

module.exports = Event