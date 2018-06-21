// seed data controller
//
// use /event/purge to delete collection
// use /event/seed to insert seed data

module.exports = function (app, mongoose) {

    // load Event model for mongo
    var Event = require('../models/eventModel')


    // seed database
    app.get('/event/seed', function (req, res) {


        var seedEvents = [{
                event: {
                    name: "A presentation about interesting things",
                    location: "Shropshire meeting room A",
                    presenter: "Andrew Young",
                    start: "2018-06-01 15:00:00",
                    end: "2018-06-01 17:00:00",
                    email: "aj@myemail.com",
                    notes: "really iteresting things will be discussed here",
                    pin: "AJF-PIE",
                    deleted: false,
                },
                feedback: [{
                        starRating: 5,
                        engaging: 5,
                        inspiring: 5,
                        informative: 5,
                        notes: "fantastic presentation, really enjoyed it",
                        name: "Garth Candova",
                        email: "garth.candova@place.com",
                        date: "2018-06-14 17:00:00"
                    },
                    {
                        starRating: 2,
                        engaging: 3,
                        inspiring: 1,
                        informative: 4,
                        notes: "trully lacking in content",
                        name: "Natalie Nandia",
                        email: "nat.nandia@it.co.co",
                        date: "2018-06-01 17:00:00"
                    },
                    {
                        starRating: 3,
                        engaging: 4,
                        inspiring: 5,
                        informative: 3,
                        notes: "nicely done",
                        name: "Maria Melnova Soares",
                        email: "maria.m.soares@there.co.uk",
                        date: "2018-06-11 12:00:00"
                    }
                ]
            },
            {
                event: {
                    name: "Secret and Important Things",
                    location: "Addenbrooke 401",
                    presenter: "Jack Mayselles",
                    start: "2018-04-01 11:00:00",
                    end: "2018-04-01 13:00:00",
                    email: "jakm@liftingcars.com",
                    notes: "shhhhh",
                    pin: "EFI-2EN",
                        deleted: false,
                },
                feedback: [{
                    starRating: 4,
                    engaging: 3,
                    inspiring: 4,
                    informative: 5,
                    notes: "fantastic presentation, really enjoyed it"
                }]
            },
            {
                event: {
                    name: "A presentation about all things jam",
                    location: "Coffee Shop",
                    presenter: "Martino Slavino Mangos",
                    start: "2018-01-01 11:00:00",
                    end: "2018-01-01 13:00:00",
                    email: "martino.mangos@fruit.com",
                    notes: "this is going to be su-eet",
                    pin: "113-MTG",
                        deleted: false,
                },
                feedback: [{
                        starRating: 5,
                        engaging: 3,
                        inspiring: 3,
                        informative: 5,
                        notes: "tasty!",
                        name: "Burt Londaster",
                        email: "burt.londaster@tomtom.com",
                        date: "2018-01-04 17:00:00"
                    },
                    {
                        starRating: 2,
                        engaging: 3,
                        inspiring: 1,
                        informative: 4,
                        notes: "trully lacking in content",
                        name: "Garth Candova",
                        email: "garth.candova@place.com",
                        date: "2018-01-05 17:00:00"
                    },
                    {
                        starRating: 3,
                        engaging: 4,
                        inspiring: 5,
                        informative: 3,
                        notes: "nicely done",
                        name: "Maria Melnova Soares",
                        email: "maria.m.soares@there.co.uk",
                        date: "2018-06-08 12:00:00"
                    }
                ]
            },
            {
                event: {
                    name: "All about wood and nails",
                    location: "Worshop 101",
                    presenter: "Enis Boughdough",
                    start: "2018-03-01 09:00:00",
                    end: "2018-03-01 13:00:00",
                    email: "ensb@bready.co.uk",
                    notes: "come see me nail things down in thi sone",
                    pin: "PEK-YKM",
                        deleted: false,
                },
                feedback: [{
                    starRating: 4,
                    engaging: 3,
                    inspiring: 4,
                    informative: 5,
                    notes: "fantastic presentation, really enjoyed it",
                    name: "Marcus Yalady",
                    email: "em.yalady@huha.com",
                    date: "2018-08-05 12:00:00"
                }]
            },
            {
                event: {
                    name: "Going round roundabouts",
                    location: "Telford",
                    presenter: "Dan Buster",
                    start: "2018-02-03 17:00:00",
                    end: "2018-02-03 18:00:00",
                    email: "dan.buster@lancaster.co.uk",
                    notes: "you spin me right round baby right round",
                    pin: "EUD-K6N",
                        deleted: false,
                },
                feedback: [{
                        starRating: 5,
                        engaging: 5,
                        inspiring: 5,
                        informative: 5,
                        notes: "captivating analysis of Telfords roundabouts",
                        name: "Pan Nasonic",
                        email: "pan.sonic@hedge.com",
                        date: "2018-05-05 08:00:00"
                    }, {
                        starRating: 5,
                        engaging: 5,
                        inspiring: 5,
                        informative: 5,
                        notes: "amazing insight into the story of our roundabouts",
                        name: "Iain Veins",
                        email: "ian.veins@body.co.uk",
                        date: "2018-06-05 17:00:00"
                    },
                    {
                        starRating: 5,
                        engaging: 5,
                        inspiring: 5,
                        informative: 5,
                        notes: "best talk ever on roundabouts, I love roundabouts",
                        name: "",
                        email: "",
                        date: "2018-06-01 12:00:00"
                    }, {
                        starRating: 5,
                        engaging: 5,
                        inspiring: 5,
                        informative: 5,
                        notes: "they are round and they get about",
                        name: "Hugo Sordugo",
                        email: "hugo.sordugo@duggydug.com",
                        date: "2018-07-23 19:10:00"
                    }
                ]
            },
            {
                event: {
                    name: "Sun and planets",
                    location: "Planet Rock, room 4",
                    presenter: "Const Alation",
                    start: "2018-06-09 10:00:00",
                    end: "2018-06-09 11:00:00",
                    email: "consty@alation.com",
                    notes: "come see us rock about planets",
                    pin: "FEP-2FB",
                        deleted: false,
                },
                feedback: [{
                    starRating: 1,
                    engaging: 1,
                    inspiring: 2,
                    informative: 3,
                    notes: "I don't like planets, I like cheese",
                    name: "",
                        email: "",
                        date: "2018-10-10 11:00:00"
                }, {
                    starRating: 5,
                    engaging: 5,
                    inspiring: 5,
                    informative: 5,
                    notes: "Love planets, great stuff. Hate cheese though",
                    name: "Vivian Livian",
                        email: "viv.liv@stiv.com",
                        date: "2018-11-11 11:11:11"
                }]
            },
            {
                event: {
                    name: "Midnight snacking",
                    location: "The fridge bar",
                    presenter: "Monica Louinska",
                    start: "2018-01-01 23:59:58",
                    end: "2018-01-01 23:59:59",
                    email: "monica@whiteroom.com",
                    notes: "snaking at it's best",
                    pin: "A3G-3IE",
                        deleted: false,
                },
                feedback: [{
                    starRating: 3,
                    engaging: 5,
                    inspiring: 1,
                    informative: 5,
                    notes: "snacking at it's best",
                    name: "",
                    email: "",
                    date: "2018-10-10 11:00:00"
                }, {
                    starRating: 3,
                    engaging: 3,
                    inspiring: 3,
                    informative: 3,
                    notes: "was ok, average snacks in the fridge",
                    name: "Davido Moon",
                    email: "d.moon@off.com",
                    date: "2018-04-02 13:10:00"
                }]
            }
        ]

        Event.create(seedEvents, function (err, data) {
            if (err) {
                res.send(err)
            } else {
                res.send(data)
            }

        })
    })


    // purge people collection
    app.get('/event/purge', function (req, res) {

        mongoose.connection.db.dropCollection('events', function (err, data) {

            if (err) {
                res.send(err)
            } else {
                res.send(data)
            }
        })

    })


}