// index.ts

import { scrapeSkyDemonOrder } from './lib/websites/skydemonorder';
import { scrapeFenrirTranslations } from './lib/websites/fenrirtranslations';
import { props } from './config';


scrapeSkyDemonOrder(props.skydemonorderUrls).catch(console.error);
//scrapeFenrirTranslations(props.fenrirtranslationsUrls).catch(console.error);
