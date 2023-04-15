const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

const logger = (request, response, next) => {
  console.log(request.query);
  next();
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken }`);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Returns a list of all states in the state table
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
        SELECT
            state_id as stateId,
            state_name as stateName,
            population
        FROM
            state;`;
  const stateArray = await db.all(getStatesQuery);
  response.send(stateArray);
});

//Returns a state based on the state ID
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT
            state_id as stateId,
            state_name as stateName,
            population
        FROM
            state
        WHERE 
        stateId=${stateId};`;
  const stateDetail = await db.get(getStateQuery);
  response.send(stateDetail);
});

//Create a district in the district table, district_id is auto-incremented
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  console.log(request.body);
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
    INSERT INTO
      district (district_name,state_id,cases,cured,active,deaths)
    VALUES
      (
        '${districtName}',
         ${stateId},
         ${cases},
         ${cured},
         ${active},
         ${deaths}
      );`;

  const dbResponse = await db.run(addDistrictQuery);
  //const districtId = dbResponse.lastID;
  response.send("District Successfully Added");
});

//Returns a district based on the district ID
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateQuery = `
        SELECT
            district_id as districtId,
            district_name as districtName,
            state_id as stateId,
            cases,
            cured,
            active,
            deaths
        FROM
            district
        WHERE 
        district_id=${districtId};`;
    const districtDetail = await db.get(getStateQuery);
    response.send(districtDetail);
  }
);

//Deletes a district from the district table based on the district ID
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM
      district
    WHERE
      district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updatedDistrictQuery = `
    UPDATE
      district
    SET
      district_name='${districtName}',
      state_id=${stateId},
      cases=${cases},
      cured=${cured},
      active=${active},
      deaths=${deaths}
    WHERE
      district_id = ${districtId};`;
    await db.run(updatedDistrictQuery);
    response.send("District Details Updated");
  }
);

//Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateQuery = `
    SELECT 
        SUM(cases) as totalCases, 
        SUM(cured) as totalCured, 
        SUM(active) as totalActive, 
        SUM(deaths) as totalDeaths 
    FROM 
        district
    WHERE 
        state_id = ${stateId};`;
    const stateDetail = await db.all(getStateQuery);
    response.send(stateDetail);
  }
);

module.exports = app;
