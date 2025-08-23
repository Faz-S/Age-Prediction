# 🚀 Ngrok Setup Guide for Showcasing Your App

## **Step 1: Get Your Ngrok URL**
After running `ngrok http 5000`, you'll see something like:
```
Forwarding    https://abc123.ngrok.io -> http://localhost:5000
```

**Copy that `https://abc123.ngrok.io` URL!**

## **Step 2: Update Your Config**
Edit `client/src/config.js` and replace `YOUR_NGROK_URL_HERE` with your actual ngrok URL:

```javascript
API_BASE_URL: 'https://abc123.ngrok.io' // Your actual ngrok URL here
```

## **Step 3: Start Your Servers**

### **Terminal 1 - Flask Backend:**
```bash
cd server
python app.py
```

### **Terminal 2 - React Frontend:**
```bash
cd client
npm run dev
```

### **Terminal 3 - Ngrok (already running):**
```bash
ngrok http 5000
```

## **Step 4: Share with Friends**
Send them this link: `https://abc123.ngrok.io` (your actual ngrok URL)

## **How It Works:**
- Friends visit your ngrok URL
- ngrok forwards requests to your Flask backend on port 5000
- Your Flask backend processes requests and returns responses
- Your React frontend can also use the ngrok URL for API calls

## **Important Notes:**
- ✅ Your Flask backend is now accessible from anywhere on the internet
- ✅ Friends can use your age prediction and chatbot features
- ✅ The ngrok URL will change each time you restart ngrok (unless you have a paid account)
- ✅ Keep your Flask server running while friends are testing

## **Troubleshooting:**
- If friends get errors, make sure your Flask server is running
- Check that the ngrok URL in config.js matches your current ngrok URL
- Make sure your Flask server is on port 5000
