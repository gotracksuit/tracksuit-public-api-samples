#!/usr/bin/env node

import axios from "axios";
import pLimit from "p-limit";
import yargs from "yargs";

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import assert from "node:assert";
import path from "node:path";

const argv = yargs(process.argv)
  .wrap(yargs().terminalWidth())
  .options({
    token: {
      desc: "JWT token for authenticating against the API",
      default: process.env.TRACKSUIT_API_TOKEN,
      type: "string",
      demand: true,
      defaultDescription: "Value of TRACKSUIT_API_TOKEN environment variable",
    },
    start: {
      default: "2024-06-01",
      desc: "The start date for filtering survey responses",
      type: "string",
    },
    end: {
      default: "2024-06-01",
      desc: "The end date for filtering survey responses",
      type: "string",
    },
    quiet: {
      alias: "q",
      desc: "If set, suppress log output",
      type: "boolean",
      default: false,
    },
    dest_dir: {
      alias: "o",
      desc: "Directory to write results. If omitted, results will be written to stdout.",
      type: "string",
    },
  })
  .check(
    (it) =>
      assert(
        it.dest_dir === undefined || existsSync(it.dest_dir),
        `Directory does not exist: ${it.dest_dir}`,
      ) || true,
  )
  .check(
    (it) =>
      assert(it.token, "Must provide --token or set TRACKSUIT_API_TOKEN") ||
      true,
  )
  .check((it) => /ey/.test(it.token))
  .parse();

argv.token = argv.token ?? process.env.TRACKSUIT_API_TOKEN;
assert(argv.token);

const axiosClient = axios.create({
  baseURL: "https://dev.api.gotracksuit.com/v1",
  headers: {
    Authorization: `Bearer ${argv.token}`,
    "Content-Type": "application/json",
  },
});

const fetchAccountBrands = async () => {
  const response = await axiosClient.get("/account-brands");
  assert(response.status === 200, response.statusText);
  return response.data;
};

const fetchFunnelData = async (accountBrandId) => {
  const filterResponse = await axiosClient.get(
    `funnel/filters?accountBrandId=${accountBrandId}`,
  );

  const isWithinTimespan =
    filterResponse.data.waveDates.includes(argv.start) &&
    filterResponse.data.waveDates.includes(argv.end);

  if (!isWithinTimespan) {
    return;
  }

  const url = `/bulk/funnel/${accountBrandId}?waveStartDate=${argv.start}&waveEndDate=${argv.end}`;
  const response = await axiosClient.get(url);
  assert(response.status === 200, response.statusText);
  return response.data;
};

try {
  argv.verbose && console.log(`Fetching account brands`);
  const accountBrands = await fetchAccountBrands();

  argv.quiet ||
    console.log(
      `Downloading ${accountBrands.length} brand(s) between ${argv.start}--${argv.end}`,
    );

  const limit = pLimit(10);
  const downloads = accountBrands.map(({ accountBrandId, brandName }) =>
    limit(async () => {
      argv.quiet || console.log(`Processing ${brandName} (${accountBrandId})`);

      const data = await fetchFunnelData(accountBrandId);

      if (!data) {
        argv.quiet ||
          console.warn(
            `No wave data available for ${brandName} (${accountBrandId})`,
          );
        return;
      }

      if (argv.dest_dir) {
        const filePath = path.join(
          argv.dest_dir,
          `funnel_data_${accountBrandId}.json`,
        );
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      } else {
        console.log(JSON.stringify(data));
      }
    }),
  );

  await Promise.all(downloads);
  argv.quiet || console.log("All data fetched and saved successfully.");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
