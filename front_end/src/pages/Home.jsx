// src/pages/Home.jsx
import { Link } from "react-router-dom";
export default function Home() {
    return (
        <section>
            <h1>Welcome</h1>
            <p>Start with a quick survey, then explore recommendations.</p>
            <Link to="/survey">Start Survey</Link>
        </section>
    );
}
