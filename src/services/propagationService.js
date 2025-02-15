const axios = require("axios");
const dotenv = require("dotenv");

const supabase = require("../config/supabase");
const logger = require("../config/logger");

dotenv.config();

const getNodeBaseUrl = (nodeId) => {
  const nodePorts = {
    HQ: 5000,
    REGIONAL_ASIA: 5001,
    REGIONAL_EUROPE: 5002,
    LOCAL_ISTANBUL: 5003,
    LOCAL_DELHI: 5004,
    LOCAL_BERLIN: 5005,
    LOCAL_LONDON: 5006,
  };
  return `http://0.0.0.0:${nodePorts[nodeId]}`;
};

// ========== GLOBAL POLICIES ==========

exports.fetchGlobalPolicies = async () => {
  try {
    const { data: globalPolicies, error } = await supabase
      .from("policies")
      .select("*")
      .eq("scope", "global");

    if (error) {
      logger.error("Error fetching global policies:", error.message);
      throw new Error("Failed to fetch global policies");
    }
    return globalPolicies;
  } catch (err) {
    logger.error("Error in fetchGlobalPolicies:", err.message);
    throw err;
  }
};

exports.fetchAndSaveGlobalPolicies = async () => {
  try {
    const hqBaseUrl = getNodeBaseUrl("HQ");

    const response = await axios.post(
      `${hqBaseUrl}/api/policies/propagate/global/push`,
      { isFetchReq: true },
      {
        headers: {
          "X-Internal-Propagation": "true",
        },
      }
    );

    const globalPolicies = response.data.policies;

    if (!globalPolicies || globalPolicies.length === 0) {
      logger.info("No global policies found at HQ Node.");
      return;
    }

    await this.saveGlobalPolicies(globalPolicies);
    logger.info("Global policies fetched from HQ Node and saved successfully.");
  } catch (err) {
    logger.error("Error in fetchAndSaveGlobalPoliciesFromHQ:", err.message);
    throw new Error("Failed to fetch and save global policies from HQ Node");
  }
};

exports.propagateGlobalPolicies = async () => {
  try {
    const globalPolicies = await this.fetchGlobalPolicies();

    const nodeList = [
      "REGIONAL_ASIA",
      "REGIONAL_EUROPE",
      "LOCAL_ISTANBUL",
      "LOCAL_DELHI",
      "LOCAL_BERLIN",
      "LOCAL_LONDON",
    ];

    for (const nodeId of nodeList) {
      const baseUrl = getNodeBaseUrl(nodeId);
      try {
        await axios.post(
          `${baseUrl}/api/policies/propagate/global/fetch`,
          {
            policies: globalPolicies,
          },
          {
            headers: {
              "X-Internal-Propagation": "true",
            },
          }
        );
        logger.info(`Global policies propagated to ${nodeId}`);
      } catch (err) {
        logger.error(
          `Error propagating global policies to ${nodeId}:`,
          err.message
        );
      }
    }

    return globalPolicies;
  } catch (err) {
    logger.error("Error in propagateGlobalPolicies:", err.message);
    throw err;
  }
};

exports.saveGlobalPolicies = async (policies) => {
  try {
    for (const policy of policies) {
      // Check if the policy already exists in the local database
      const rulesString = JSON.stringify(policy.rules);
      const { data: existingPolicy, error: fetchError } = await supabase
        .from("policies")
        .select("*")
        .eq("policyname", policy.policyname)
        .eq("scope", policy.scope)
        .eq("rules", rulesString)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // Ignore "No rows found" error
        logger.error("Error checking for existing policy:", fetchError.message);
        throw new Error("Failed to check for existing policy");
      }

      // If the policy doesn't exist, save it
      if (!existingPolicy) {
        const { error: createError } = await supabase
          .from("policies")
          .insert([policy]);

        if (createError) {
          logger.error("Error saving policy:", createError.message);
          throw new Error("Failed to save policy");
        }

        logger.info(
          `Saved new global policy: ${policy.policyname} at ${process.env.NODE_ID}`
        );
      } else {
        logger.info(
          `Policy already exists: ${policy.policyname} at ${process.env.NODE_ID}`
        );
      }
    }
  } catch (err) {
    logger.error("Error in saveGlobalPolicies:", err.message);
    throw err;
  }
};

exports.propagateGlobalPolicyUpdate = async (oldPolicy, newPolicy) => {
  try {
    if (oldPolicy.scope !== "global" || newPolicy.scope !== "global") {
      logger.warn("Skipping non-global policy update propagation");
      return;
    }

    const nodeList = [
      "REGIONAL_ASIA",
      "REGIONAL_EUROPE",
      "LOCAL_ISTANBUL",
      "LOCAL_DELHI",
      "LOCAL_BERLIN",
      "LOCAL_LONDON",
    ];

    for (const nodeId of nodeList) {
      const baseUrl = getNodeBaseUrl(nodeId);
      try {
        const response = await axios.post(
          `${baseUrl}/api/policies/propagate/global/update`,
          {
            oldPolicy,
            newPolicy,
          },
          {
            headers: {
              "X-Internal-Propagation": "true",
            },
          }
        );

        if (response.status === 200) {
          logger.info(
            `Successfully propagated global policy update to node: ${nodeId}`
          );
        } else {
          logger.warn(
            `Unexpected response status ${response.status} from node: ${nodeId}`
          );
        }
      } catch (error) {
        logger.error(
          `Failed to propagate global policy update to node: ${nodeId}`,
          error
        );
      }
    }

    logger.info("Global policy update propagation completed.");
  } catch (error) {
    logger.error(
      "An error occurred during global policy update propagation:",
      error
    );
    throw error;
  }
};

exports.propagateGlobalPolicyDelete = async (oldPolicy) => {
  try {
    if (oldPolicy.scope !== "global") {
      logger.warn("Skipping non-global policy delete propagation");
      return;
    }

    const nodeList = [
      "REGIONAL_ASIA",
      "REGIONAL_EUROPE",
      "LOCAL_ISTANBUL",
      "LOCAL_DELHI",
      "LOCAL_BERLIN",
      "LOCAL_LONDON",
    ];

    for (const nodeId of nodeList) {
      const baseUrl = getNodeBaseUrl(nodeId);
      try {
        const response = await axios.post(
          `${baseUrl}/api/policies/propagate/global/delete`,
          {
            oldPolicy,
          },
          {
            headers: {
              "X-Internal-Propagation": "true",
            },
          }
        );

        if (response.status === 200) {
          logger.info(
            `Successfully propagated global policy delete to node: ${nodeId}`
          );
        } else {
          logger.warn(
            `Unexpected response status ${response.status} from node: ${nodeId}`
          );
        }
      } catch (error) {
        logger.error(
          `Failed to propagate global policy delete to node: ${nodeId}`,
          error
        );
      }
    }

    logger.info("Global policy delete propagation completed.");
  } catch (error) {
    logger.error(
      "An error occurred during global policy delete propagation:",
      error
    );
    throw error;
  }
};

// ========== REGIONAL POLICIES ==========

exports.propagateRegionalPolicies = async (nodeTarget) => {
  try {
    const { data: regionalPolicies, error } = await supabase
      .from("policies")
      .select("*")
      .eq("scope", "regional");

    if (error) {
      logger.error("Error fetching regional policies:", error.message);
      throw new Error("Failed to fetch regional policies");
    }

    if (!regionalPolicies || regionalPolicies.length === 0) {
      logger.info("No regional policies found.");
      return;
    }

    const currentRegion = process.env.REGION;
    let localNodes;

    if (!nodeTarget) {
      localNodes = currentRegion
        ? // If region is specified, propagate to local nodes in the same region
          currentRegion === "Asia"
          ? ["LOCAL_ISTANBUL", "LOCAL_DELHI"]
          : ["LOCAL_BERLIN", "LOCAL_LONDON"]
        : // If region is null, propagate to all local nodes
          ["LOCAL_ISTANBUL", "LOCAL_DELHI", "LOCAL_BERLIN", "LOCAL_LONDON"];
    } else {
      localNodes = [nodeTarget];
    }

    for (const nodeId of localNodes) {
      const baseUrl = getNodeBaseUrl(nodeId);
      try {
        await axios.post(
          `${baseUrl}/api/policies/propagate/regional/fetch`,
          {
            policies: regionalPolicies,
          },
          {
            headers: {
              "X-Internal-Propagation": "true",
            },
          }
        );
        logger.info(`Regional policies pushed to ${nodeId}`);
      } catch (err) {
        logger.error(
          `Error pushing regional policies to ${nodeId}:`,
          err.message
        );
      }
    }

    return regionalPolicies;
  } catch (err) {
    logger.error("Error in pushRegionalPolicies:", err.message);
    throw err;
  }
};

exports.fetchRegionalPolicies = async (policies) => {
  try {
    if (process.env.NODE_TYPE !== "local") {
      logger.error("pullRegionalPolicies can only be run from a Local Node");
      throw new Error("This API is only usable from a Local Node");
    }

    if (policies && policies.length > 0) {
      // If policies are provided, save them directly
      await this.saveRegionalPolicies(policies);
      logger.info("Regional policies saved successfully.");
      return;
    }

    // Determine the region of the current node
    const currentRegion = process.env.REGION;

    const regionalNodes = currentRegion
      ? // If region is specified, pull from the corresponding Regional Node
        [currentRegion === "Asia" ? "REGIONAL_ASIA" : "REGIONAL_EUROPE"]
      : // If region is null, pull from all Regional Nodes
        ["REGIONAL_ASIA", "REGIONAL_EUROPE"];

    let fetchedPolicies = [];

    for (const nodeId of regionalNodes) {
      const baseUrl = getNodeBaseUrl(nodeId);
      try {
        const response = await axios.post(
          `${baseUrl}/api/policies/propagate/regional/push`,
          {
            targetNode: `${process.env.NODE_ID}`,
          },
          {
            headers: {
              "X-Internal-Propagation": "true",
            },
          }
        );
        if (response.data && Array.isArray(response.data)) {
          fetchedPolicies = fetchedPolicies.concat(response.data);
        }
        logger.info(`Regional policies pulled from ${nodeId}`);
      } catch (err) {
        logger.error(
          `Error pulling regional policies from ${nodeId}:`,
          err.message
        );
      }
    }

    await this.saveRegionalPolicies(fetchedPolicies);
    logger.info("Regional policies pulled and saved successfully.");
  } catch (err) {
    logger.error("Error in pullRegionalPolicies:", err.message);
    throw err;
  }
};

exports.saveRegionalPolicies = async (policies) => {
  try {
    for (const policy of policies) {
      // Check if the policy already exists in the local database
      const rulesString = JSON.stringify(policy.rules);
      const { data: existingPolicy, error: fetchError } = await supabase
        .from("policies")
        .select("*")
        .eq("policyname", policy.policyname)
        .eq("scope", policy.scope)
        .eq("rules", rulesString)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // Ignore "No rows found" error
        logger.error("Error checking for existing policy:", fetchError.message);
        throw new Error("Failed to check for existing policy");
      }

      // If the policy doesn't exist, save it
      if (!existingPolicy) {
        const { error: createError } = await supabase
          .from("policies")
          .insert([policy]);

        if (createError) {
          logger.error("Error saving policy:", createError.message);
          throw new Error("Failed to save policy");
        }

        logger.info(`Saved new regional policy: ${policy.policyname}`);
      } else {
        logger.info(`Policy already exists: ${policy.policyname}`);
      }
    }
  } catch (err) {
    logger.error("Error in saveRegionalPolicies:", err.message);
    throw err;
  }
};

exports.propagateRegionalPolicyUpdate = async (oldPolicy, newPolicy) => {
  try {
    if (oldPolicy.scope !== "regional" || newPolicy.scope !== "regional") {
      logger.warn("Skipping non-regional policy update propagation");
      return;
    }

    const currentRegion = process.env.REGION;
    localNodes = currentRegion
      ? // If region is specified, propagate to local nodes in the same region
        currentRegion === "Asia"
        ? ["LOCAL_ISTANBUL", "LOCAL_DELHI"]
        : ["LOCAL_BERLIN", "LOCAL_LONDON"]
      : // If region is null, propagate to all local nodes
        ["LOCAL_ISTANBUL", "LOCAL_DELHI", "LOCAL_BERLIN", "LOCAL_LONDON"];

    for (const nodeId of localNodes) {
      const baseUrl = getNodeBaseUrl(nodeId);
      try {
        const response = await axios.post(
          `${baseUrl}/api/policies/propagate/regional/update`,
          {
            oldPolicy,
            newPolicy,
          },
          {
            headers: {
              "X-Internal-Propagation": "true",
            },
          }
        );

        if (response.status === 200) {
          logger.info(
            `Successfully propagated regional policy update to node: ${nodeId}`
          );
        } else {
          logger.warn(
            `Unexpected response status ${response.status} from node: ${nodeId}`
          );
        }
      } catch (error) {
        logger.error(
          `Failed to propagate regional policy update to node: ${nodeId}`,
          error
        );
      }
    }

    logger.info("Regional policy update propagation completed.");
  } catch (error) {
    logger.error(
      "An error occurred during Regional policy update propagation:",
      error
    );
    throw error;
  }
};

exports.propagateRegionalPolicyDelete = async (oldPolicy) => {
  try {
    if (oldPolicy.scope !== "regional") {
      logger.warn("Skipping non-regional policy delete propagation");
      return;
    }

    const currentRegion = process.env.REGION;
    localNodes = currentRegion
      ? // If region is specified, propagate to local nodes in the same region
        currentRegion === "Asia"
        ? ["LOCAL_ISTANBUL", "LOCAL_DELHI"]
        : ["LOCAL_BERLIN", "LOCAL_LONDON"]
      : // If region is null, propagate to all local nodes
        ["LOCAL_ISTANBUL", "LOCAL_DELHI", "LOCAL_BERLIN", "LOCAL_LONDON"];

    for (const nodeId of localNodes) {
      const baseUrl = getNodeBaseUrl(nodeId);
      try {
        const response = await axios.post(
          `${baseUrl}/api/policies/propagate/regional/delete`,
          {
            oldPolicy,
          },
          {
            headers: {
              "X-Internal-Propagation": "true",
            },
          }
        );

        if (response.status === 200) {
          logger.info(
            `Successfully propagated regional policy delete to node: ${nodeId}`
          );
        } else {
          logger.warn(
            `Unexpected response status ${response.status} from node: ${nodeId}`
          );
        }
      } catch (error) {
        logger.error(
          `Failed to propagate regional policy delete to node: ${nodeId}`,
          error
        );
      }
    }

    logger.info("Regional policy delete propagation completed.");
  } catch (error) {
    logger.error(
      "An error occurred during regional policy delete propagation:",
      error
    );
    throw error;
  }
};
