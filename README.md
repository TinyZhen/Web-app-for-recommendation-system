# Web-app-for-recommendation-system

When you pull the repository for changes

1. Create firebase.js in src folder in front_end folder i.e., /src/firebase.js file

firebase.js file content:
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    //Add your firebaseConfig
  };

  export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

To get your firebaseConfig go to recommender-system project and click on project settings of cs682 webapp and then scroll down and choose config then you will get copy paste code of firebaseConfig.

2. Create serviceAccountKey.json in backend folder i.e., /backend/serviceAccountKey.json

serviceAccountKey.json content:

 To get the content go to recommender-system project and click on project settings of cs682 webapp and then click on Service Accounts and then click generate new private key by choosing Node.js under Admin SDK Configuration snippet and then click generate private key in pop up window and copy the code snippet which you will get and paste it in serviceAccountKey.json 

3. Create .env file in backend folder and paste the below code in it

GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json
ALLOWED_ORIGINS=http://localhost:5173
PORT=8000

