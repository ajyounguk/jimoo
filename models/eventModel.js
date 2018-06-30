// event model for mongo
//
// event is our main domain object to capture feedback on
// (not some fancy event handling thing)

var mongoose = require('mongoose')

// data 
var Schema = mongoose.Schema

var eventSchema = new Schema({
    event: {
        name: String,
        location: String,
        presenter: String,
        email: String,
        start: Date,
        end: Date,
        notes: String,
        pin: String,
        deleted: Boolean
    },
    feedback: [{
        rating: {
            event: Number,
            presenter: Number,
            engaging: Number,
            innovative: Number,
            inspiring: Number,
            informative: Number
        },
        notes: String,
        name: String,
        email: String,
        date: Date
    }]
})


// person schema for mongo 
var Event = mongoose.model('Event', eventSchema)

module.exports = Event