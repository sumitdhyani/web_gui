import Visual from './ContentRoot'
import {useEffect, useState} from 'react'
import './App.css';
const {init, subscribe, unsubscribe, subscribeVirtual, unsubscribeVirtual} = require('./root/Gui-Library-Interface')
const logger = { debug : str => console.log(str),
  info : str => console.log(str),
  warn : str => console.log(str),
  error : str => console.log(str)
 }

let allowed_instruments = new Map()
let allowed_exchanges = []
function App() {
  const [libraryInitialized, setLibraryInitialized] = useState(false)

  useEffect(()=>{
    logger.warn(`Initializing the library`)
    init({auth_server : ["http://165.232.187.129:90","http://143.244.139.3:90","http://143.244.131.67:90"], credentials : {user : "test_user", password : "test_pwd"}},
    //init({auth_server : "http://127.0.0.1:90", credentials : {user : "test_user", password : "test_pwd"}},
         logger,
         (profile)=>{
          allowed_instruments = profile.allowed_instruments
          allowed_exchanges = profile.allowed_exchanges
          
          logger.warn(`Library initialized`)
          setLibraryInitialized(true)})
    return ()=>{}
  },[])
  
  function getExchangeKeyedSymbolDict(dict){
    const exchangeKeyedSymbolDict = new Map()
    dict.forEach((item, key)=>{
      const exchange = item.exchange
      if(undefined === exchangeKeyedSymbolDict.get(exchange)){
        exchangeKeyedSymbolDict.set(exchange, new Map())
      }

      const exchangeLevelBook = exchangeKeyedSymbolDict.get(exchange)
      exchangeLevelBook.set(key, item)
    })

    return exchangeKeyedSymbolDict
  }

  console.log(`render Cycle, libraryInitialized : ${libraryInitialized}`)
  if(libraryInitialized){
    const context = { symbol_dict : allowed_instruments,
                      subscription_functions : {subscribe : subscribe, unsubscribe : unsubscribe},
                      virtual_subscription_functions : {subscribe : subscribeVirtual, unsubscribe : unsubscribeVirtual},
                      exchanges : allowed_exchanges
                    }
    return (
      <Visual context={context}/>
    );
  }else{
    return (
      <>Before Init</>
    );
  }  
}

//function App() {
//  const [dataArray, setDataArray] = useState([])
//
//  if(!started){
//    start((data) => {
//      setDataArray([...data.values()])
//    }).then(()=>{})
//
//    started = true
//  }
//
//
//  return (
//    <div className="App">
//      <MyComponent store={dataArray}/>
//    </div>
//  );
//}

export default App;
