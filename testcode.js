


console.log('==========================================')


var dateNow = new Date(Date.now()).toISOString().split('T')[0]
var timeNow = new Date(Date.now()).toTimeString().split(' ')[0].substr(0, 5)

var thisYear = new Date(Date.now()).getFullYear()
var thisMonth = new Date(Date.now()).getMonth() 

var listStartDate = new Date(thisYear, thisMonth, 2 ).toISOString().split('T')[0]
var listEndDate = new Date(thisYear, thisMonth +1 , 2).toISOString().split('T')[0]



console.log('liststart',listStartDate)
console.log('listend',listEndDate)

