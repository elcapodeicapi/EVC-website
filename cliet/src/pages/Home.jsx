import React from "react";
import Navbar from "./Navbar";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div>
      <Navbar />
      <div className="content">
        <h1>Welkom bij het EVC Platform 👋</h1>
        <p>Met dit platform kun je eenvoudig:</p>
        <ul>
          <li>Je <b>portfolio</b> opbouwen</li>
          <li><b>Bewijsstukken</b> uploaden</li>
          <li><b>Berichten</b> sturen</li>
          <li>En je voortgang volgen via de <b>planning</b></li>
        </ul>
        <p>
          <Link to="/register"><button>Start nu →</button></Link>
        </p>
        <p>Al een account? <Link to="/login">Log hier in</Link>.</p>
      </div>
    </div>
  );
};

export default Home;
