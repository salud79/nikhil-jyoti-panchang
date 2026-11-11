# निखिल ज्योति पंचांग स्रोत का मसौदा

यह समीक्षा के लिए है। इसमें Wix Preview के लिए तैयार मुख्य पंचांग कोड और अब तक प्राप्त गणना फ़ाइलें हैं।

## Wix सेटअप
- Backend में backend फ़ोल्डर की फ़ाइलें उनके नाम से रखें। .web.js फ़ाइलें Web Module हैं।
- मुख्य Panchang पेज के Page Code में page/Panchang.js का कोड रखें।
- उसी पेज के #htmlPanchang Embed में page/htmlPanchang.html का कोड रखें।
- Wix npm में sweph-wasm 2.6.9 इस्तेमाल हुआ है। यह Swiss Ephemeris 2.10.03 को Moshier और Lahiri सेटिंग के साथ चलाता है।
- https://github.com/ptprashanttripathi/sweph-wasm
- https://github.com/aloistr/swisseph

## समीक्षा बाकी
- स्थान खोज के लिए Wix की कॉपी में backend/places.web.js का YOUR_GEONAMES_USERNAME अपने GeoNames खाते के उपयोगकर्ता नाम से बदलें और उस खाते पर Web Services चालू करें।
- Wix में लगे वास्तविक संस्करणों से सभी फ़ाइलें मिलानी हैं।
- प्रकाशित संस्करण के लिए लागू लाइसेंस, नोटिस और संबंधित स्रोत की उपलब्धता की समीक्षा बाकी है।

