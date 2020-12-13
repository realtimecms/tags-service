const app = require('./app.js')
const validators = require("../validation")

const definition = app.createServiceDefinition({
  name: "tags",
  eventSourcing: true,
  validators
})

module.exports = definition