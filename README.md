# Quantitative Pricing Model & Financial Dashboard

A lightweight, client-side financial modeling engine engineered to analyze pricing strategies, forecast revenue curves, and run quantitative risk analyses. Built to bridge theoretical microeconomics with practical financial technology, this tool allows users to simulate how price changes impact volume, revenue, and profit margins under various market conditions.

## 📊 Core Financial Engine

The dashboard's underlying mathematical engine calculates key performance indicators (KPIs) based on user-defined baseline operations and dynamic economic variables:

* **Demand Elasticity:** Models quantity demanded against proposed price shifts, supporting both linear demand curves and advanced constant-elasticity power functions ($Q = aP^{PED}$).
* **Cross-Price Elasticity (XED):** Integrates competitor pricing shifts to adjust baseline volume prior to internal PED execution.
* **Cost Dynamics & Margins:** Dynamically calculates new Break-Even Volumes and Gross Margins, factoring in optional economies of scale (Variable Cost volume discounts).
* **Monte Carlo Risk Simulator:** Executes a 1,000-iteration simulation injecting a ±20% variance into the PED to forecast 5th Percentile (Downside), Median, and 95th Percentile (Upside) profit expectations.

## 🛠 Technical Architecture

* **Frontend:** Plain HTML5, CSS3 (CSS Variables for True Dark/Light Mode), and Vanilla JavaScript (ES6+). Zero build-step required; runs entirely natively in the browser.
* **Data Visualization:** Dual-Axis `Chart.js` integration rendering real-time parabolic profit and revenue curves, alongside dynamic scenario comparison plotting.
* **State Management & Persistence:** Custom localized state manager using `localStorage` to save, reload, and compare historical scenarios without requiring a backend database.
* **Export Capabilities:** 
  * Custom BLOB generation for instantaneous `.csv` data exports and `.json` payloads.
  * `jsPDF` integration combined with hidden HTML Canvas rendering to generate formatted executive summary reports.

## 🚀 Usage & Installation

Because this application relies entirely on client-side JavaScript, there is no server setup, database configuration, or dependency installation required.

1. Clone or download this repository.
2. Double-click `index.html` to open the dashboard natively in any modern web browser.
3. Input your baseline financial metrics (Fixed Costs, Variable Costs, Price, Volume).
4. Utilize the **Simulation Controls** to manipulate pricing, or click **Auto-Maximize Profit** to algorithmically snap to the mathematical peak of the profit curve.

## 💡 Academic & Professional Use Case

This tool was designed to demonstrate a practical application of A-Level Economics and Business principles. It showcases the ability to translate academic theories—such as demand elasticity, margin optimization, and probabilistic risk—into a functional, interactive piece of financial software.
