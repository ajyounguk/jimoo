// Jimoo - feedback controler
// web ui and mongo controller for the admin interactions 
//

module.exports = function (app) {

    // load Event model for mongo
    var Event = require('../models/eventModel')

    // ui = data object holds all data required by the UI
    //
    // set ui.debug for json ouput of the data
    //
    // ui.flow.activateDiv = div to be enabled when form loads
    // ui.flow.activateButton = button to be enabled when form loads
    // 
    // ui.data = main data structure for capturing UI inputs/outputs
    // ui.data.create = create screens data
    // ui.data.search = list screens data

    var ui = {
        debug: false,
        flow: {
            activateDiv: null,
            activateButton: 'create-button',
        },
        data: {
            create: {},
            search: {},
            modify: {}
        }
    }

    // init UI = helper function
    function initUI(uiElement) {

        if (uiElement == 'create') {

            // calc dates = todays date and time
            var dateNow = new Date(Date.now()).toISOString().split('T')[0]
            var timeNow = new Date(Date.now()).toTimeString().split(' ')[0].substr(0, 5)

            ui.data.create = {
                timestamp: null,
                todayDate: dateNow,
                todayTime: timeNow,
                event: {
                    name: null,
                    location: null,
                    presenter: null,
                    start: null,
                    end: null,
                    email: null,
                    notes: null,
                    pin: null
                }
            }
        }

        if (uiElement === 'search') {

            // calc todays date & todays date + 1 month (for list ui controls)
            var thisYear = new Date(Date.now()).getFullYear()
            var thisMonth = new Date(Date.now()).getMonth() 
            var listStartDate = new Date(thisYear, thisMonth, 2 ).toISOString().split('T')[0]
            var listEndDate = new Date(thisYear, thisMonth +1 , 2).toISOString().split('T')[0]

            ui.data.search = {
                timestamp: null,
                startDate: listStartDate,
                endDate: listEndDate,
                events: []
            }
        }


        if (uiElement == 'modify') {

            // calc dates = todays date and time
            var dateNow = new Date(Date.now()).toISOString().split('T')[0]
            var timeNow = new Date(Date.now()).toTimeString().split(' ')[0].substr(0, 5)

            ui.data.modify = {
                timestamp: null,
                todayDate: dateNow,
                todayTime: timeNow,
                event: {
                    id: null,
                    name: null,
                    location: null,
                    presenter: null,
                    start: null,
                    end: null,
                    email: null,
                    notes: null,
                    pin: null
                }
            }
        }
    }


    // Make PIN = helper function
    function makePin (attempts, callback) {        

        if (attempts >= 20) {
            console.log('ERROR, pin generation failed after too many collisions (20)')
            callback('too may attempts at pin generation', null)
        }

        var text = ""
        var possible = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        
        for (var i = 0; i <= 6; i++) {
            if (i == 3) {
                text += '-'
            } else {
                text += possible.charAt(Math.floor(Math.random() * possible.length))
            }
        }

        // check PIN doesn't already exist
        Event.find({ 'event.pin': text }, function(err, result) {

            if (err) {
                callback (err, null) // error
            } else {
                if (result.length) {
                    attempts++
                    console.log ('WARNING, collision detected in pin generation attempt', 1)
                    makePin(attempts, callback)
                    
                } else {
                    callback (null, text) // no pin collision all good
                }
            }
        })
    }


    // load admin form
    app.get('/', function (req, res) {

        // init the UI object
        initUI('create')
        initUI('search')
        initUI('modify')

        // set timestamp & init ui flow
        var date = new Date(Date.now())
        ui.data.create.timestamp = date    
        ui.flow.activateDiv = 'create-div'
        ui.flow.activateButton = 'create-button'  

        res.setHeader('Content-Type', 'text/html');
        res.render('./index', {
            ui: ui
        })
    })


    // 1a. Create event 
    // (capture form data and generate pin)
    app.post('/admin/event/create-ok', function (req, res) { 

        // init UI        
        var date = new Date(Date.now())
        ui.data.create.timestamp = date    
        ui.flow.activateDiv = 'create-confirmation-div'
        ui.flow.activateButton = 'create-button'        

        ui.data.create.event.name = req.body.name
        ui.data.create.event.location = req.body.location
        ui.data.create.event.presenter = req.body.presenter
        ui.data.create.event.email = req.body.email
        ui.data.create.event.notes = req.body.notes
        ui.data.create.event.startdate = req.body.startdate
        ui.data.create.event.starttime = req.body.starttime
        ui.data.create.event.enddate = req.body.enddate
        ui.data.create.event.endtime = req.body.endtime 
        
        // if we don't have a PIN, generate it
        if (ui.data.create.event.pin == null) {
            makePin (0, function (err, pincode) {
                if (err) {
                    res.status = 500
                    console.log(err)
                    res.render(err)
                } else {
                    res.status = 200
                    ui.data.create.event.pin = pincode
                    // render confirmation screen
                    res.render('./index.ejs', {
                        ui: ui
                    })
                }
            })
        } else {
            res.status = 200
            // render confirmation screen
            res.render('./index.ejs', {
                ui: ui
            })
        }
    })


    // 1b. Create event, confirm, ok 
    // (create mongo doc if pin doesn't exist, otherwise update it to cater for browser refresh and back)
    app.get('/admin/event/create-confirm-ok', function (req, res) { 
        
        // set timestamp & init ui flow
        var date = new Date(Date.now())
        ui.data.create.timestamp = date    
        ui.flow.activateDiv = 'event-created-div'
        ui.flow.activateButton = 'create-button'

        // PIN maker helper function
        // generates random 5 char code + checks if collision exists in mongo
        
        // setup date and time for mongo insert
        var startd = new Date(ui.data.create.event.startdate + " " + ui.data.create.event.starttime)
        var endd = new Date(ui.data.create.event.enddate + " " + ui.data.create.event.endtime)
    
        // match on PIN
        var query = {'event.pin' : ui.data.create.event.pin }
    
        var data = {
            event: {
                name: ui.data.create.event.name,
                location: ui.data.create.event.location,
                presenter: ui.data.create.event.presenter,
                email: ui.data.create.event.email,
                notes: ui.data.create.event.notes,
                start: startd,
                end: endd,
                pin: ui.data.create.event.pin
            }
        }

        // find pin, if found updated it, if not create new doc (option upsert = true)
        Event.findOneAndUpdate( query, data, {upsert: true}, function (err, event) {
            if (err) {
                res.status = 500
                console.log(err)
                res.render(err)
            } else {
                res.status = 201
                // redirect to save screen
                res.render('./index.ejs', {
                    ui: ui
                })
            }
        })
    })


    // 1c. Create event - cancel or go back
    // (redisplay the event create form but don't reset it )
    app.get('/admin/event/create-confirm-back', function (req, res) {

        // set timestamp & init ui flow
        var date = new Date(Date.now())
        ui.data.create.timestamp = date    
        ui.flow.activateDiv = 'create-div'
        ui.flow.activateButton=  'create-button'
        
        res.status(200)
        res.render('./index.ejs', {
            ui: ui
        })
    })
    

    // 2. Search
    app.post('/admin/event/search', function (req, res) {

        // set timestamp & init ui flow
        var date = new Date(Date.now())
        ui.data.search.timestamp = date    
        ui.flow.activateDiv = 'search-div'
        ui.flow.activateButton = 'search-button'

        // reset anything in the create form
        initUI('create')

        // prepare search form dates to be used by mongo filter
        var startdate = new Date(req.body.lstartdate +' 00:00:00')
        var enddate = new Date(req.body.lenddate +' 24:00:00')
      
        Event.find({
            'event.start': {
                $gte: startdate,
                $lte: enddate
            }
        }, function (err, events) {

            if (err) {
                ui.data.search.status = '500'
                ui.data.search.response = err
                console.log(err)
            } else {
                ui.data.search.status = '200'
                ui.data.search.events = events
            }

            res.render('./index.ejs', {
                ui: ui
            })
        })
    })


    // 3. Modify existing
    app.get('/admin/event/modify/:id', function (req, res) {

        // set timestamp & init ui flow
        var date = new Date(Date.now())
        ui.data.modify.timestamp = date    
        ui.flow.activateDiv = 'modify-div'
        ui.flow.activateButton=  'modify-button'

        var id = req.params.id;

        Event.findById(id, function (err, event) {
            if (err) {
                res.status(500)
                res.render(err)
                console.log(err)
            } else {
                ui.data.modify.event.id         = id
                ui.data.modify.event.name       = event.event.name
                ui.data.modify.event.location   = event.event.location
                ui.data.modify.event.presenter  = event.event.presenter
                ui.data.modify.event.email      = event.event.email
                ui.data.modify.event.notes      = event.event.notes
                ui.data.modify.event.pin        = event.event.pin        

                res.render('./index.ejs', {
                    ui: ui
                })
            }
        })
    })
}