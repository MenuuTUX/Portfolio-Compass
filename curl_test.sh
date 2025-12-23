curl -s "http://localhost:3000/api/etfs/search?limit=5&includeHistory=true" > page1.json
curl -s "http://localhost:3000/api/etfs/search?limit=5&includeHistory=true&skip=5" > page2.json
echo "Page 1 count: $(grep -o '"ticker":' page1.json | wc -l)"
echo "Page 2 count: $(grep -o '"ticker":' page2.json | wc -l)"
