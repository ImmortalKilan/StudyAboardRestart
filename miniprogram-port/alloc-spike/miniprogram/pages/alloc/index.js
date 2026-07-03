const mp = require('miniprogram-render')
const getBaseConfig = require('../base.js')
const config = require('../../config')

function init(window, document) {require('../../common/alloc~7fe3bdb9.js')(window, document)}

const baseConfig = getBaseConfig(mp, config, init)

Component({
    ...baseConfig.base,
    methods: {
        ...baseConfig.methods,
        
        
        
    },
})
