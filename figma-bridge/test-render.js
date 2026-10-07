import http from 'http';

const designSpec = {
  type: "FRAME",
  name: "SaaS Pro Pricing Card",
  width: 360,
  height: 480,
  x: 100,
  y: 100,
  backgroundColor: "#18181b",
  cornerRadius: 16,
  strokeColor: "#27272a",
  strokeWeight: 1,
  layoutMode: "VERTICAL",
  padding: 28,
  itemSpacing: 18,
  primaryAxisAlignItems: "MIN",
  counterAxisAlignItems: "MIN",
  children: [
    {
      type: "TEXT",
      name: "Badge",
      text: "MOST POPULAR",
      fontSize: 11,
      color: "#60a5fa",
      fontFamily: "Inter",
      fontStyle: "Bold"
    },
    {
      type: "TEXT",
      name: "Plan Title",
      text: "Pro Plan",
      fontSize: 24,
      color: "#ffffff",
      fontFamily: "Inter",
      fontStyle: "Bold"
    },
    {
      type: "TEXT",
      name: "Description",
      text: "Everything you need to build and scale your next generation application.",
      fontSize: 13,
      color: "#a1a1aa",
      fontFamily: "Inter",
      fontStyle: "Regular"
    },
    {
      type: "TEXT",
      name: "Price",
      text: "$29 / month",
      fontSize: 32,
      color: "#ffffff",
      fontFamily: "Inter",
      fontStyle: "Bold"
    },
    {
      type: "FRAME",
      name: "Feature List",
      width: 304,
      height: 120,
      backgroundColor: "#27272a",
      cornerRadius: 10,
      layoutMode: "VERTICAL",
      padding: 14,
      itemSpacing: 10,
      children: [
        {
          type: "TEXT",
          name: "Feature 1",
          text: "✓  Unlimited cloud automations",
          fontSize: 12,
          color: "#e4e4e7"
        },
        {
          type: "TEXT",
          name: "Feature 2",
          text: "✓  Up to 20 team collaborators",
          fontSize: 12,
          color: "#e4e4e7"
        },
        {
          type: "TEXT",
          name: "Feature 3",
          text: "✓  24/7 Priority support & API access",
          fontSize: 12,
          color: "#e4e4e7"
        }
      ]
    },
    {
      type: "FRAME",
      name: "CTA Button",
      width: 304,
      height: 44,
      backgroundColor: "#3b82f6",
      cornerRadius: 8,
      layoutMode: "HORIZONTAL",
      primaryAxisAlignItems: "CENTER",
      counterAxisAlignItems: "CENTER",
      children: [
        {
          type: "TEXT",
          name: "Button Label",
          text: "Get Started Now →",
          fontSize: 14,
          color: "#ffffff",
          fontFamily: "Inter",
          fontStyle: "Bold"
        }
      ]
    }
  ]
};

const req = http.request({
  hostname: 'localhost',
  port: 4321,
  path: '/render',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Result:', data);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(JSON.stringify(designSpec));
req.end();
