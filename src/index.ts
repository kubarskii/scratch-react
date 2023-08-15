// Using the "myReact" library we built
import v from './core/vdom';

// Components
function Header() {
    return v.createElement(
        "header",
        { style: "background-color: #f7f7f7; padding: 10px; text-align: center;" },
        v.createElement(
            "h1",
            null,
            "Welcome to MyProduct!"
        ),
        v.createElement(
            "p",
            null,
            "The best product you've never used."
        )
    );
}

function MainContent() {
    const [showDetails, setShowDetails] = v.useState(false);
    const [ditto, setDitto] = v.useState(null);
    v.useEffect(() => {
        fetch('https://pokeapi.co/api/v2/pokemon/ditto').then(data => data.json()).then(setDitto)
    }, [])
    return v.createElement(
        "div",
        { style: "padding: 20px; text-align: center;" },
        v.createElement(
            "p",
            null,
            "Discover the endless possibilities with MyProduct."
        ),
        v.createElement(
            "button",
            {
                style: "padding: 10px 15px; margin-top: 20px;",
                onClick: () => {
                    setShowDetails(!showDetails)
                }
            },
            showDetails ? "Hide Details" : "Show Details"
        ),
        showDetails ?
            v.createElement(
                "div",
                { style: "margin-top: 20px;" },
                "MyProduct allows you to do X, Y, and Z. Experience the power of the most advanced product.",
                v.createElement('div', null, JSON.stringify(ditto))
            ) : null
    );
}

function Footer() {
    return v.createElement(
        "footer",
        { style: "background-color: #333; color: #fff; padding: 10px; text-align: center;" },
        "© 2023 MyProduct Inc."
    );
}

function App() {
    return v.createElement(
        "div",
        null,
        v.createElement(Header, null),
        v.createElement(MainContent, null),
        v.createElement(Footer, null),
    );
}

// Render
const rootElement = document.getElementById("root");
v.render(v.createElement(App, null), rootElement);
