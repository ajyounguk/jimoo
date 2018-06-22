// Jimoo - feedback controler
// web ui and mongo controller for the feedback interactions (provide feedback on event)
//

module.exports = function (app) {


    // load UI data model 
    var ui = require('../models/uiDataModel')

    // Helper - reset UI data
    function resetUI() {

        ui.data.feedback = {

        }

    }


    // 1 - Show PIN entry form
    // 
    // called from: /
    // displays: pin entry form
    //
    // loads the pin entry form
    //
    app.get('/', function (req, res) {


        resetUI()

        // ui flow
        ui.flow.timestamp = new Date(Date.now())
        ui.flow.activateDiv = 'pin-div'
        ui.flow.activateButton = 'pin-button'

        res.setHeader('Content-Type', 'text/html');
        res.render('./index.ejs', {
            ui: ui
        })
    })

    app.get('/:id', function (req, res) {

        console.log('feedback')

    })

}