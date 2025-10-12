# Web-app-for-recommendation-system

When you pull the repository for changes <br>

1. Create firebase.js in src folder in front_end folder i.e., /src/firebase.js file  <br>

firebase.js file content:  <br>
import { initializeApp } from 'firebase/app';  <br>
import { getAuth } from 'firebase/auth';  <br>
import { getFirestore } from 'firebase/firestore'; <br>

// For Firebase JS SDK v7.20.0 and later, measurementId is optional <br>
const firebaseConfig = { <br>
    //Add your firebaseConfig <br>
  }; <br>

  export const app = initializeApp(firebaseConfig); <br>
export const auth = getAuth(app); <br>
export const db = getFirestore(app); <br>

To get your firebaseConfig go to recommender-system project and click on project settings of cs682 webapp and then scroll down and choose config then you will get copy paste code of firebaseConfig. <br>

2. Create serviceAccountKey.json in backend folder i.e., /backend/serviceAccountKey.json <br>
<br>
serviceAccountKey.json content: <br>
<br>
 To get the content go to recommender-system project and click on project settings of cs682 webapp and then click on Service Accounts and then click generate new private key by choosing Node.js under Admin SDK Configuration snippet and then click generate private key in pop up window and copy the code snippet which you will get and paste it in serviceAccountKey.json  <br>
<br>
3. Create .env file in backend folder and paste the below code in it <br>
<br>
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json <br>
ALLOWED_ORIGINS=http://localhost:5173 <br>
PORT=8000 <br>

