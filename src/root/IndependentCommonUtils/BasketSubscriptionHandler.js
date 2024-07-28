const CommonUtils = require('./CommonUtils')
const Event = CommonUtils.Event
const {subscribeList, unsubscribeList} = require('./SubscribeList')

const m1 = new Map()
function subscribeListwithCoefficients(symbols, coefficients, exchange, vanillaSubscriptionFunction, callback){
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

        subscribeList(symbols, exchange, vanillaSubscriptionFunction, matter.callback)
        m1.set(key, matter)
    }
    
    matter.evt.registerCallback(callback)
}

function unsubscribeListwithCoefficients(symbols, coefficients, exchange, vanillaUnsubscriptionFunction, callback){
    const key = JSON.stringify([...symbols, ...coefficients, exchange])
    const matter = m1.get(key)
    if (undefined === matter) {
        throw new Error(`Spurious unsubscription for key: ${key}`)
    }

    matter.evt.unregisterCallback(callback)
    if (matter.evt.empty()) {
        unsubscribeList(symbols, exchange, vanillaUnsubscriptionFunction, matter.callback)
        m1.delete(key)
    }
}


const m3 = new Map()
function subscribeBasket(symbols, coefficients, exchange, vanillaSubscriptionFunction, conversionSymbol, staticInfo ,callback){
    const conversionNeeded = (conversionSymbol !== null)
    const key = JSON.stringify([...symbols, ...coefficients, exchange, conversionNeeded? conversionSymbol: ""])
    let matter = m3.get(key)
    if (undefined === matter) {
        const priceConversionEvt = new Event()
        let conversionFactor = conversionNeeded? null : 1
        matter = {
            conversionCallback  :   update => { conversionFactor = 1/update.price },
            conversionApplier   :   price =>{
                                        if (null != conversionFactor) {
                                            priceConversionEvt.raise({...staticInfo, price: price*conversionFactor})
                                        }
                                    },
            evt                 :   priceConversionEvt   
        }

        if (conversionNeeded) {
            vanillaSubscriptionFunction(conversionSymbol, exchange, "trade", matter.conversionCallback)
        }
        subscribeListwithCoefficients(symbols, coefficients, exchange, vanillaSubscriptionFunction, matter.conversionApplier)
        m3.set(key, matter)
    }

    try {
        matter.evt.registerCallback(callback)
    } catch(err) {
        throw new Error(`This callback is already registered for the key: ${key}`)
    }
}

function unsubscribeBasket(symbols, coefficients, exchange, vanillaUnsubscriptionFunction, conversionSymbol, callback){
    const conversionWasNeeded = (conversionSymbol !== null)
    const key = JSON.stringify([...symbols, ...coefficients, exchange, conversionWasNeeded? conversionSymbol: ""])
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
        if (conversionWasNeeded) {
            vanillaUnsubscriptionFunction(conversionSymbol, exchange, "trade", matter.conversionCallback)
        }
        unsubscribeListwithCoefficients(symbols, coefficients, exchange, vanillaUnsubscriptionFunction, matter.conversionApplier)
        m3.delete(key)
    }
}


module.exports.subscribeBasket = subscribeBasket
module.exports.unsubscribeBasket = unsubscribeBasket