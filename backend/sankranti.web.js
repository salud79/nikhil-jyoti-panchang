// Wix Backend → sankranti.web.js
import { Permissions, webMethod } from 'wix-web-module';
import { getSankrantiTimes } from './sankranti';

// मुख्य पंचांग के सभी पाठकों के लिए 2026 की तय तालिका।
export const getSankranti2026 = webMethod(
  Permissions.Anyone,
  () => getSankrantiTimes(2026)
);
