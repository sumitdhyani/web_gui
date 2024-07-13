const CommonUtils = require('./CommonUtils')
const appSpecificErrors = require('./appSpecificErrors')
const [SpuriousUnsubscription, DuplicateSubscription] = [appSpecificErrors.SpuriousUnsubscription, appSpecificErrors.DuplicateSubscription]
const Event = CommonUtils.Event

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
                            prices[symbolToIndex.get(update.symbol)] = update
                            if (checkIfAllUpdatesReceived()) {
                                priceEvt.raise(prices)
                            }
                          },
            evt         : priceEvt
        }

        m2.set(key, matter)

        symbols.forEach(symbol => {
            subscriptionFunction(symbol, exchange, "trade", matter.listUpdator)
        })
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
                            }))
                        },
            evt      :  consolidatedPriceEvt
        }

        m1.set(key, matter)
        subscribeList(symbols, exchange, subscriptionFunction, matter.callback)
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
        unsubscribeList(symbols, exchange, unsubscriptionFunction, matter.coefficientApplier)
        m2.delete(key)
    }
}


const m3 = new Map()
function subscribeBasket(symbols, coefficients, exchange, subscriptionFunction, conversionSymbol, callback){
    const key = JSON.stringify([...symbols, ...coefficients, exchange, conversionSymbol])
    let matter = m3.get(key)
    if (undefined === matter) {
        const priceConversionEvt = new Event()
        let conversionFactor = null
        matter = {
            conversionCallback  :   price=> { conversionFactor = 1/price },
            conversionApplier   :   price=>{
                                        if (null != conversionFactor ) {
                                            priceConversionEvt.raise(price*conversionFactor)
                                        }
                                    },
            evt                 :   priceConversionEvt   
        }

        m3.set(key, matter)
        subscriptionFunction(conversionSymbol, exchange, "trade", matter.conversionCallback)
        subscribeListwithCoefficients(symbols, coefficients, exchange, subscriptionFunction, matter.conversionApplier)
    }

    matter.evt.registerCallback(callback)
}

function unsubscribeBasket(symbols, coefficients, exchange, unsubscriptionFunction, conversionSymbol, callback){
    const key = JSON.stringify([...symbols, ...coefficients, exchange, conversionSymbol])
    const matter = m3.get(key)
    if (undefined === matter) {
        throw new Error(`Spurious unsubscription for key: ${key}`)
    } 

    matter.evt.unregisterCallback(callback)
    if (matter.evt.empty()) {
        unsubscriptionFunction(conversionSymbol, exchange, "trade", matter.conversionCallback)
        unsubscribeListwithCoefficients(symbols, coefficients, exchange, unsubscriptionFunction, matter.conversionApplier)
        m3.delete(key)
    }
}


module.exports.subscribeBasket = subscribeBasket
module.exports.unsubscribeBasket = unsubscribeBasket