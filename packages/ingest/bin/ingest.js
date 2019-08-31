#!/usr/bin/env node

const handler = require('../').handler

// call handler
const event = JSON.parse(process.argv.slice(2))
console.log(event)
handler(event)
