// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IStorage.sol";

/// @title MockStorage — onout.org Storage mock for local testing
contract MockStorage is IStorage {
    mapping(string => AppData) private _data;

    constructor(address initialOwner, string memory domain) {
        _data[domain] = AppData({
            owner: initialOwner,
            data: ""
        });
    }

    function getData(string calldata domain) external view override returns (AppData memory) {
        return _data[domain];
    }

    function setData(string calldata domain, bytes calldata data) external override {
        // Only owner can update data
        require(
            _data[domain].owner == address(0) || _data[domain].owner == msg.sender,
            "MockStorage: not owner"
        );
        _data[domain].data = data;
    }

    function setOwner(string calldata domain, address owner) external {
        _data[domain].owner = owner;
    }
}
