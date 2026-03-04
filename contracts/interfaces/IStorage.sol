// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IStorage — interface for onout.org Storage contract
/// @notice Same Storage contract used by launchpad/dex at 0xa7472f384339D37EfE505a1A71619212495A973A on BSC
interface IStorage {
    struct AppData {
        address owner;
        bytes data;
    }

    function getData(string calldata domain) external view returns (AppData memory);
    function setData(string calldata domain, bytes calldata data) external;
}
