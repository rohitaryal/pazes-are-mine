import fs from "fs";
import readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

let domainPath = process.argv[2];               // File path to subdomain name list
let pageHash = process.argv[3];                  // MD5 hash  for URL (unique to each user maybe)
let userCookie = process.argv[4];               // Full cookie of an cloudflare account

let hasProvidedCookie = false;                  // For internal purpose
let hasProvidedPath = process.argv.length > 2;  // For internal purpose

const prompt = async (emoji = "❔", message = "Your message") => {
    return new Promise((resolve) => {
        rl.question((`${emoji}: ${message}: `), (value) => {
            resolve(value.trim());
        })
    })
}

const checkPageAvailability = async (hash, subDomainName, cookie) => {
    // Make request to check a page name availability
    const req = await fetch(`https://dash.cloudflare.com/api/v4/accounts/${hash}/pages/get_subdomain?project_name=${subDomainName}`, {
        "headers": {
            "cookie": cookie,
        }
    });

    // Parse to JSON
    const res = await req.json();

    // If it was a success
    if (res.success) {
        // If cloudflare agrees with our subdomain name
        return res.result.subdomain == `${subDomainName}.pages.dev`
    }
    console.log("😩: Failed to get subdomain status", req.status);
    console.log(res.errors[0].message);
    return false;
}

const acquireSubdomain = async (hash, subDomainName, cookie) => {
    // Ask for subdomain
    const req = await fetch(`https://dash.cloudflare.com/api/v4/accounts/${hash}/pages/projects`, {
        "headers": {
            "cookie": cookie,
        },
        "body": JSON.stringify({
            "name": subDomainName,
            "production_branch": "main"
        }),
        "method": "POST"
    });

    // Parse to JSON
    let res;
    if (req.ok) {
        res = await req.json();
    } else {
        console.log(await req.text())
        return;
    }

    // If we had success: We got the subdomain
    if (res.success) {
        console.log(`✅: Acquired: ${res.result.subdomain}`)
    }
    // Ignore the un-successful ones
}

// Ask for cookie
while (!userCookie) {
    if (hasProvidedCookie) {
        console.log("⚠️ : Invalid Cookies");
    }
    userCookie = await prompt("🍪", "Your account cookies");
}

// Clear just to hide cookies from screen
console.clear();

// Ask for domain list file path
while (!domainPath || !fs.existsSync(domainPath)) {
    if (hasProvidedPath) {
        console.log("⚠️ : File doesn't exist: " + domainPath);
    }
    domainPath = await prompt("💾", "Please provide file with subdomain list");
    hasProvidedPath = true;
}

// Ask for hash
while (!pageHash) {
    pageHash = await prompt("🔑", "What hash do you see in cloudflare URL while creating subdomain")
}

// Create a reader stream to process large list easily
const reader = fs.createReadStream(domainPath);

// Pass the stream to rl in order to read file line by line
const rlFile = readline.createInterface({
    input: reader,
    crlfDelay: Infinity,
});

// For each chunk processed
let i = 0;
for await (const line of rlFile) {
    const subDomainName = line.trim();
    process.stdout.write(`🔍 ${subDomainName}${" ".repeat(50 - subDomainName.length)}[${++i}]\r`)
    if (await checkPageAvailability(pageHash, subDomainName, userCookie)) {
        await acquireSubdomain(pageHash, subDomainName, userCookie)
    }
}
