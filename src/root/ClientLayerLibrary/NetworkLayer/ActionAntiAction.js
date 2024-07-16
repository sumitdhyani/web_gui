class ActionAntiAction{
    constructor(logger){
        this.keysAndTimers = new Map()
        this.logger = logger
    }

    act(key, timeout, func) {
        if (undefined === this.keysAndTimers.get(key)) {
            //console.log(`Action queued on key: ${key}`)
            this.keysAndTimers.set(key, setTimeout(()=> { 
                func()
                this.keysAndTimers.delete(key)
                this.logger.debug(`Action executed on key: ${key}`)
        }, timeout))
        } else {
            //console.log(`Duplicate action on key: ${key}`)
        }
    }

    antiAct(key, func) {
        const timer = this.keysAndTimers.get(key)
        if (undefined === timer) {
            func()
            //console.log(`Anti-Action executed on key: ${key}`)
        } else {
            clearTimeout(timer)
            this.keysAndTimers.delete(key)
            //console.log(`Action cancelled for key: ${key}`)
        }
    }
}

module.exports.ActionAntiAction = ActionAntiAction
