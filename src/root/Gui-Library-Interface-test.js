const {init, subscribe, unsubscribe, subscribeVirtual, unsubscribeVirtual, subscribeBasket, unsubscribeBasket} = require('./Gui-Library-Interface')
function getFormattedTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`
}

const logger = {  debug : str => console.log(`${getFormattedTimestamp()}: ${str}`),
    info : (str) =>console.log(`${getFormattedTimestamp()}: ${str}`),
    warn : (str) =>console.log(`${getFormattedTimestamp()}: ${str}`),
    error : (str) =>console.log(`${getFormattedTimestamp()}: ${str}`)
}

 init({auth_server : ["http://node_1:90","http://node_1:91","http://node_1:92"], credentials : {user : "test_user", password : "test_pwd"}},
 //init({auth_server : "http://127.0.0.1:90", credentials : {user : "test_user", password : "test_pwd"}},
      logger,
      mainLoop)

function onUpdate(update){
    logger.debug(JSON.stringify(update))
}

function mainLoop(meta){
    const symbolDict = meta.allowed_instruments
    //symbolDict.forEach((item, key)=>{logger.debug(`Key: ${key}`)})
          function actionForNormalSymbol(action, symbol){
        try{
            if(0 === action.localeCompare("subscribe")){
                subscribe(symbol, "BINANCE", "trade", onUpdate)
            }
            else{
                unsubscribe(symbol, "BINANCE", "trade", onUpdate)
            }
        }
        catch(err){
            logger.warn(`Error while ${action} for ${symbol}, details: ${err.message}`)
        }
    }

    function actionForVirtualSymbol(action, asset, currency, bridge){
        try{
            if(0 === action.localeCompare("subscribe")){
                subscribeVirtual(asset, currency, bridge, "BINANCE", onUpdate)
            }
            else{
                unsubscribeVirtual(asset, currency, bridge, "BINANCE", onUpdate)
            }
        }
        catch(err){
            logger.warn(`Error while ${action} for ${JSON.stringify([asset, currency, bridge, "BINANCE"])}, details: ${err.message}`)
        }
    }

    function actionForBasket(params) {//(assets, coefficients, bridgeCurrency, targetAsset, exchange, callback){ 
        try {
            if(0 === params.action.localeCompare("subscribe")){
                try {
                    subscribeBasket(params.assets,
                                    params.coefficients,
                                    params.allowedBridgeCurrency,
                                    params.targetAsset,
                                    params.exchange,
                                    onUpdate)
                } catch(err) {
                    logger.warn(`Error: ${err.message} stack: ${err.stack}`)
                }
            }
            else{
                try {
                    unsubscribeBasket(params.assets,
                                      params.coefficients,
                                      params.allowedBridgeCurrency,
                                      params.targetAsset,
                                      params.exchange,
                                      onUpdate)
                } catch(err) {
                    logger.warn(`Error: ${err.message} stack: ${err.stack}`)
                }
            }
        }
        catch(err){
        }
    }

    const cyclicalFunc = (symbol)=>{
        setTimeout(()=> {
            actionForNormalSymbol("subscribe", symbol)
            setTimeout(()=>{
                actionForNormalSymbol("unsubscribe", symbol)
                cyclicalFunc(symbol)
            }, 10000)
        }, 5000)
    }

    const cyclicalFuncForVirtual = (asset, currency, bridge)=>{
        setTimeout(()=> {
            actionForVirtualSymbol("subscribe", asset, currency, bridge)
            setTimeout(()=>{
                actionForVirtualSymbol("unsubscribe", asset, currency, bridge)
                cyclicalFuncForVirtual(asset, currency, bridge)
            }, 10000)
        }, 5000)
    }

    const cyclicalFuncForBasket = (params) =>{//(assets, coefficients, bridgeCurrency, targetAsset, exchange, callback) =>{
        setTimeout(()=> {
            actionForBasket({...params, action: "subscribe"})
                setTimeout(()=>{
                    actionForBasket({...params, action : "unsubscribe"})
                    cyclicalFuncForBasket(params)
                }, 10000)
        }, 12000)
    }
    
    const numInstruments = 2
    const allowedBridgeCurrency = "USDT"
    const filteredSymbols = [...symbolDict.values()].filter( obj=> 0 === obj.quoteAsset.localeCompare(allowedBridgeCurrency))
    for(let i = 0; i < numInstruments; i++){
        //cyclicalFunc(filteredSymbols[i].symbol)
        cyclicalFuncForVirtual(filteredSymbols[i].baseAsset, filteredSymbols[i+1].baseAsset, allowedBridgeCurrency)
        //const returnAsItIs = (price) => { return price }
        //cyclicalFuncForBasket({
        //    assets                  : [filteredSymbols[i].baseAsset, filteredSymbols[i+1].baseAsset],
        //    coefficients            : [3,2],
        //    allowedBridgeCurrency   : "USDT",
        //    targetAsset             : "BTC",
        //    exchange                : "BINANCE"
        //})
    }
}   