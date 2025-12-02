import yahooFinance from 'yahoo-finance2';

console.log("Type of default:", typeof yahooFinance);
console.log("Is quoteSummary present?", !!yahooFinance.quoteSummary);
console.log("Is quoteSummary a function?", typeof yahooFinance.quoteSummary === 'function');
try {
    const instance = new yahooFinance();
    console.log("Can be instantiated?", !!instance);
} catch (e) {
    console.log("Cannot be instantiated:", e.message);
}
