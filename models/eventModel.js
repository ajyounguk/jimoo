var mongoose = require('mongoose')

// data 
var Schema = mongoose.Schema

var eventSchema = new Schema({
    event: {
        name: String,
        location: String,
        presenter: String,
        start: Date,
        end: Date,
        notes: String
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
var Event = mongoose.model('Event', eventSchema)

module.exports = Event