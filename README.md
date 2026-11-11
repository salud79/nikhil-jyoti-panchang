# निखिल ज्योति पंचांग

यह रिपॉज़िटरी निखिल ज्योति के मुख्य Wix पंचांग पेज का स्रोत रखती है। इसमें पेज कोड, HTML Embed और पंचांग की गणना करने वाली Backend फ़ाइलें हैं।

## गणना

तिथि, नक्षत्र, योग और करण के सूर्योदय-आधारित मान और उनके समाप्ति समय Swiss Ephemeris 2.10.03 से निकाले जाते हैं। एकीकरण में `sweph-wasm` 2.6.9, Moshier और लाहिड़ी की सेटिंग इस्तेमाल होती है। सूर्योदय, मुहूर्त और व्रत-पर्व के नियम इस परियोजना के अपने मॉड्यूलों में हैं। उपयोग किए गए Swiss Ephemeris स्रोत, सटीक संशोधन और बिल्ड स्क्रिप्ट [SWISS-SOURCES.md](SWISS-SOURCES.md) में दर्ज हैं।

## Wix पर सेटअप

1. Wix Editor में Dev Mode चालू करें। Package Manager में `sweph-wasm` का संस्करण `2.6.9` इंस्टॉल करें।
2. [backend](backend/) की फ़ाइलें Wix के Backend में उन्हीं नामों से रखें। `.web.js` फ़ाइलें Web Modules हैं और `.js` फ़ाइलें साधारण Backend JavaScript फ़ाइलें हैं।
3. शहर की खोज के लिए Wix की `backend/places.web.js` कॉपी में `YOUR_GEONAMES_USERNAME` की जगह अपना GeoNames उपयोगकर्ता नाम रखें। GeoNames खाते में Web Services सक्रिय करें।
4. मुख्य Panchang पेज में [Page Code](page/Panchang.js) लगाएँ। उसके HTML Embed का ID `htmlPanchang` रखें और उसमें [पूरा HTML](page/htmlPanchang.html) लगाएँ।
5. Wix Preview में वाराणसी, 11 नवंबर 2026 की गणना चलाएँ। तिथि और करण की समाप्ति 15:53:56 IST और नक्षत्र की समाप्ति 11:38:25 IST होनी चाहिए। योग की समाप्ति 12 नवंबर को 03:40:34 IST होनी चाहिए।

## लाइसेंस

इस परियोजना का वह मूल कोड जिसे परियोजना के अधिकारधारक लाइसेंस देते हैं, **GNU Affero General Public License, version 3** के तहत उपलब्ध है। पूरा पाठ [LICENSE](LICENSE) में है। निर्भरताओं और तीसरे पक्ष के कोड पर उनके अपने लाइसेंस और नोटिस लागू हैं। [sweph-wasm का लाइसेंस](LICENSE-sweph-wasm.txt) और [Swiss Ephemeris के स्रोत व नोटिस](SWISS-SOURCES.md) देखें।

यह सॉफ़्टवेयर लाइसेंस की शर्तों के अनुसार बिना वारंटी के उपलब्ध है।
