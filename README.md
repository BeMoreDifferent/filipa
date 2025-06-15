# Filipa AI 🤖

**Take back control of your AI conversations. Filipa is the first open-source, local-first mobile AI application with native support for the Model Context Protocol (MCP), built on the principles of privacy, flexibility, and true data ownership.**

<p align="center">
  <img alt="MIT License" src="https://img.shields.io/badge/License-MIT-blue.svg"/>
  <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"/>
  <img alt="Expo" src="https://img.shields.io/badge/expo-51-purple"/>
  <img alt="React Native" src="https://img.shields.io/badge/react--native-0.79-blue"/>
</p>

<p align="center">
  <img src="assets/images/screenshots/Screenshot 2025-06-15 at 13.23.42.png" width="250" alt="Filipa AI - Settings Screen" />
  <img src="assets/images/screenshots/Screenshot 2025-06-15 at 13.23.51.png" width="250" alt="Filipa AI - Dark Mode" />
  <img src="assets/images/screenshots/Screenshot 2025-06-15 at 13.24.08.png" width="250" alt="Filipa AI - Conversation History" />
</p>
<p align="center">
  <img src="assets/images/screenshots/Screenshot 2025-06-15 at 13.24.01.png" width="250" alt="Filipa AI - Main Chat Interface" />
  <img src="assets/images/screenshots/Screenshot 2025-06-15 at 13.24.14.png" width="250" alt="Filipa AI - Model & Provider Selection" />
  <img src="assets/images/screenshots/Screenshot 2025-06-15 at 13.24.23.png" width="250" alt="Filipa AI - MCP Tool Integration" />
</p>


---

## ✨ Core Principles: Your AI, Your Rules

Filipa AI was created to put you back in the driver's seat. In a world of closed ecosystems and data harvesting, we offer a different path.

-   **🔒 Absolute Privacy & No Tracking:** Your conversations are for your eyes only. We don't track you, we don't analyze your data, and we don't have access to your chats. All data is stored locally on your device, adhering to the spirit of top-tier German privacy standards. You can confidently use Filipa AI knowing your information remains yours.

-   **🚀 Total Flexibility:** Don't be locked into a single AI provider. Filipa AI is built to connect to any OpenAI-compatible API. Whether you want to use major providers like OpenAI, Groq, or self-hosted models running on your own hardware, the choice is yours.

-   **✊ True Data Ownership:** This is a local-first application. Your chats, settings, and keys are stored securely on your device, not on our servers. You have the power to export, delete, and manage your data at any time, with no third-party dependency.

-   **🔌 The Future is Interoperable with MCP:** Filipa AI is proud to be the first mobile application with native support for the **Model Context Protocol (MCP)**. This groundbreaking protocol allows your AI to securely and seamlessly interact with a universe of external tools and services, unlocking capabilities that were previously impossible.

## 🌟 Key Features

-   **Secure, On-Device Storage:** All your data is saved in a local SQLite database.
-   **Multi-Provider Support:** Connect to any OpenAI-compatible API endpoint.
-   **Model Context Protocol (MCP):** The first mobile app to support this new standard for AI tool integration.
-   **Real-time Interaction:** Enjoy fast, streaming responses from your chosen AI models.
-   **Clean & Intuitive UI:** A user-friendly interface that is accessible to everyone.
-   **MIT Licensed & Open Source:** Free to use, modify, and distribute. Forever.

## 🧑‍💻 Why Contribute to Filipa AI?

This isn't just another chat app. Filipa AI is an opportunity to build the future of open, decentralized AI on a modern and professional stack.

-   **Work with a Cutting-Edge Tech Stack:** Get hands-on experience with **Expo 53**, **React Native's New Architecture**, strict **TypeScript**, **Zustand** for state management, and **Drizzle ORM** for type-safe database interactions.
-   **Pioneer the Model Context Protocol (MCP):** Be at the forefront of AI development by contributing to the first mobile implementation of MCP, a new standard for making AI interoperable with external tools.
-   **Learn Professional Engineering Practices:** The project is built on a solid foundation of clean architecture (feature-slicing, repository pattern), with a full CI/CD pipeline, automated linting, and testing enforced through GitHub Actions.
-   **Build Something That Matters:** Contribute to a non-profit, privacy-first tool that empowers users instead of exploiting them. Your work will directly support the mission of making AI accessible and safe for everyone.

## 🌱 Join Our Mission: We Need Your Help!

Filipa AI is currently in active development. We have a bold vision: to make powerful, private, and flexible AI accessible to everyone under a single, free, open-source project. But we can't do it alone.

We are looking for passionate **developers, designers, testers, and AI enthusiasts** to join us. Whether you can write code, fix bugs, improve the UI, or spread the word, your contribution is invaluable.

**👉 How to Contribute:**
1.  Familiarize yourself with the architecture by reading our **[Architecture Document (`ai/prd.md`)](./ai/prd.md)**.
2.  Check out our [Project Board](https://github.com/users/BeMoreDifferent/projects/1) to see what we're working on.
3.  Pick an open issue from the [Issues tab](https://github.com/BeMoreDifferent/filipa/issues) and feel free to ask questions.
4.  Fork the repository and submit a pull request!

Together, we can build an AI ecosystem that is open, interoperable, and respects user freedom.

## 🚀 Getting Started (for Developers)

Ready to jump in? Follow these simple steps to get the project running locally.

```bash
# 1. Clone the repository
git clone https://github.com/dnlbrgr/filipa.git
cd filipa

# 2. Install dependencies using pnpm
pnpm install

# 3. Start the Expo development server
pnpm exec expo start
```

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details. 