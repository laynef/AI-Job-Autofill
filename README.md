# AI Job Application Autofill Chrome Extension

## 🚀 Overview

This Chrome extension is designed to streamline the job application process by automatically filling out forms. It uses your saved personal and professional information, combined with the power of Google's Gemini AI, to intelligently answer a wide variety of questions, from standard text inputs to complex dropdown menus. The extension reads your PDF resume to provide contextually aware answers, saving you time and effort. It also uses a `MutationObserver` to handle dynamically loaded content, ensuring that it can autofill even the most modern and complex job application forms.

## ✨ Features

- Smart Autofill: Fills in standard fields like your name, email, address, and phone number.
- AI-Powered Answers: Leverages the Gemini API to generate professional and relevant answers for open-ended text questions.
- Intelligent Dropdown & Checkbox Selection: Analyzes dropdown and checkbox options to select the most appropriate choice based on your profile and the job description.
- PDF Resume Analysis: Reads your uploaded PDF resume to provide context for AI-generated answers, ensuring they align with your experience.
- Context-Aware: Scans the job application page to find the job description, giving the AI crucial context about the role.
- Handles Demographic Questions: Automatically and discreetly selects "Prefer not to answer" or "Decline to self-identify" for sensitive demographic questions (race, gender, disability, etc.).
- User-Friendly Interface: A simple popup allows you to easily save and update your information.
- Improved Performance and Reliability: Uses a `MutationObserver` to efficiently handle dynamic content, making the extension more reliable and performant on modern websites.

## 🛠️ Setup & Installation

- To get the extension running in your Chrome browser, follow these steps:
- Download the Project: Make sure you have all the project files (manifest.json, popup.html, popup.js, content.js) in a single folder on your computer.
- Create an images Folder: Inside the main project folder, create a new folder named images.
- Add Icons: Save your icon files (icon16.png, icon48.png, icon128.png) inside the images folder.
- Open Chrome Extensions: Launch Chrome and navigate to chrome://extensions.
- Enable Developer Mode: In the top-right corner of the Extensions page, toggle on "Developer mode".
- Load the Extension: Click the "Load unpacked" button that appears on the top-left.
- Select the Folder: In the file dialog, select your main project folder (the one containing manifest.json).
- Done! The "AI Job Application Autofill" extension should now appear in your list of extensions and in your Chrome toolbar.

## ⚙️ How to Use

- Save Your Information: Click the extension's icon, fill in your details, upload your resume, and click "Save Information".
- Autofill an Application: Navigate to a job application, click the extension's icon, and click "Autofill Page".

## 📂 File Structure

- manifest.json: The core configuration file for the Chrome extension. It defines the extension's name, version, permissions, icons, and scripts.
- popup.html: The HTML structure for the popup window that appears when you click the extension icon. This is where you input and save your data.
- popup.js: The main JavaScript file that powers the extension. It handles saving user data to Chrome's storage and contains the autofillPage function that is injected into webpages.
- content.js: A content script that is loaded on every page. While currently minimal, it can be used for more complex, persistent interactions with webpages in the future.
- /images: A folder containing the icons for the extension.

## 💻 Tech Stack

- Frontend: HTML
- Logic: JavaScript
- AI: Google Gemini API
- Platform: Chrome Extension Manifest V3