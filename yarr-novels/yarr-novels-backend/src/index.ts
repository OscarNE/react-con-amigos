// index.ts

import { scrapeSkyDemonOrder } from './skydemonorder';
import { props } from './config';


scrapeSkyDemonOrder(props.skydemonorderUrls).catch(console.error);
