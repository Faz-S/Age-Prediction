// Configuration for API endpoints
const config = {
  // Change this to your ngrok URL when sharing with friends
  // Example: 'https://abc123.ngrok.io'
  API_BASE_URL: process.env.NODE_ENV === 'production' 
    ? 'https://e374526e7c24.ngrok-free.app' // Your actual ngrok URL here
    : '', // Empty string for local development (uses relative URLs)
  
  // Helper function to get full API URL
  getApiUrl: (endpoint) => {
    return config.API_BASE_URL + endpoint;
  }
};

export default config;
