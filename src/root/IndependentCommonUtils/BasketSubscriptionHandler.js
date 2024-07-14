const CommonUtils = require('./CommonUtils')
const appSpecificErrors = require('./appSpecificErrors')
const Event = CommonUtils.Event
const {ErrorFunctionWrapper} = require('./ErrorFunctionWrapper')

let m2 = new Map()
function subscribeList(symbols, exchange, subscriptionFunction, callback) {
    const key = JSON.stringify(...symbols, exchange)
    let matter = m2.get(key)
    if (undefined === matter) {
        const symbolToIndex = new Map()
        symbols.forEach((symbol, index)=>{
            symbolToIndex.set(symbol, index)
        })

        let allUpdatesReceived = false;
        function checkIfAllUpdatesReceived() {
            if(allUpdatesReceived) {
                return true
            }

            allUpdatesReceived =
            prices.reduce((prev, price)=>{
                return prev && (price != null)
            }, true)

            return allUpdatesReceived
        }

        const prices = new Array(symbols.length).fill(null)
        const priceEvt = new Event()
        matter =
        {
            listUpdator : update=>{
                            prices[symbolToIndex.get(update.symbol)] = update.price
                            if (checkIfAllUpdatesReceived()) {
                                priceEvt.raise(prices)
                            }
                          },
            evt         : priceEvt
        }

        symbols.forEach(symbol => {
            subscriptionFunction(symbol, exchange, "trade", matter.listUpdator)
        })
        m2.set(key, matter)
    }
    
    matter.evt.registerCallback(callback)
}


function unsubscribeList(symbols, exchange, unsubscriptionFunction, callback) {
    const key = JSON.stringify(...symbols, exchange)
    const matter = m2.get(key)
    if (undefined === matter) {
        throw new Error(`Spurious unsubscription for key: ${key}`)
    }

    matter.evt.unregisterCallback(callback)
    if (matter.evt.empty()) {
        symbols.forEach(symbol=>{
            unsubscriptionFunction(symbol, exchange, "trade", matter.listUpdator)
        })
        m2.delete(key)
    }

    
}


const m1 = new Map()
function subscribeListwithCoefficients(symbols, coefficients, exchange, subscriptionFunction, callback){
    const key = JSON.stringify([...symbols, ...coefficients, exchange])
    let matter = m1.get(key)
    if (undefined === matter) {
        const consolidatedPriceEvt = new Event()
        matter =
        {
            callback :  prices=>{
                            consolidatedPriceEvt.raise(prices.reduce((prev, price, index)=>{
                                return prev + coefficients[index] * price                  
                            }, 0))
                        },
            evt      :  consolidatedPriceEvt
        }

        subscribeList(symbols, exchange, subscriptionFunction, matter.callback)
        m1.set(key, matter)
    }
    
    matter.evt.registerCallback(callback)
}

function unsubscribeListwithCoefficients(symbols, coefficients, exchange, unsubscriptionFunction, callback){
    const key = JSON.stringify([...symbols, ...coefficients, exchange])
    const matter = m1.get(key)
    if (undefined === matter) {
        throw new Error(`Spurious unsubscription for key: ${key}`)
    }

    matter.evt.unregisterCallback(callback)
    if (matter.evt.empty()) {
        unsubscribeList(symbols, exchange, unsubscriptionFunction, matter.callback)
        m1.delete(key)
    }
}


const m3 = new Map()
function subscribeBasket(symbols, coefficients, exchange, subscriptionFunction, conversionSymbol, staticInfo ,callback){
    const key = JSON.stringify([...symbols, ...coefficients, exchange, conversionSymbol])
    let matter = m3.get(key)
    if (undefined === matter) {
        const priceConversionEvt = new Event()
        let conversionFactor = null
        matter = {
            conversionCallback  :   update => { conversionFactor = 1/update.price },
            conversionApplier   :   price =>{
                                        if (null != conversionFactor) {
                                            priceConversionEvt.raise({...staticInfo, price: price*conversionFactor})
                                        }
                                    },
            evt                 :   priceConversionEvt   
        }

        subscriptionFunction(conversionSymbol, exchange, "trade", matter.conversionCallback)
        subscribeListwithCoefficients(symbols, coefficients, exchange, subscriptionFunction, matter.conversionApplier)
        m3.set(key, matter)
    }

    try {
        matter.evt.registerCallback(callback)
    } catch(err) {
        throw new Error(`This callback is already registered for the key: ${key}`)
    }
}

function unsubscribeBasket(symbols, coefficients, exchange, unsubscriptionFunction, conversionSymbol, callback){
    const key = JSON.stringify([...symbols, ...coefficients, exchange, conversionSymbol])
    const matter = m3.get(key)
    if (undefined === matter) {
        throw new Error(`Spurious unsubscription for key: ${key}`)
    } 

    try {
        matter.evt.unregisterCallback(callback)
    } catch(err) {
        throw new Error(`This callback is not registered for the key: ${key}`)
    }

    if (matter.evt.empty()) {
        unsubscriptionFunction(conversionSymbol, exchange, "trade", matter.conversionCallback)
        unsubscribeListwithCoefficients(symbols, coefficients, exchange, unsubscriptionFunction, matter.conversionApplier)
        m3.delete(key)
    }
}


module.exports.subscribeBasket = subscribeBasket
module.exports.unsubscribeBasket = unsubscribeBasket