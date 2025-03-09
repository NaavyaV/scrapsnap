# ScrapSnap 🌱

ScrapSnap is a gamified recycling platform that encourages proper waste disposal through image recognition and verification. Users can upload photos of items they want to dispose of, receive AI-powered disposal instructions, and earn points by verifying their disposal through video submissions.

## Features

- 📸 **Smart Item Recognition**: Upload photos of items and get instant classification using Google's Gemini AI
- 🎯 **Guided Disposal**: Receive specific instructions on how to properly dispose of or recycle items
- 🎮 **Gamification**: Earn points for properly disposing of items, with bonus points for challenging materials
- 📊 **Leaderboard**: Compete with other users and track your environmental impact
- ✅ **Video Verification**: Submit short videos to verify proper disposal and earn points
- 📱 **Responsive Design**: Beautiful, modern UI that works on both desktop and mobile

## Tech Stack

- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Firebase Realtime Database
- **AI/ML**: Google Generative AI (Gemini)
- **Authentication**: Firebase Auth

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory with your API keys:
   ```env
   REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
   REACT_APP_GEMINI_API_KEY=your_gemini_api_key
   ```
4. Start the development server:
   ```bash
   npm start
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
