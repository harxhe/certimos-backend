// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Certificate
 * @dev A unique, non-fungible token representing a certificate of achievement.
 */
contract Certificate is ERC721, Ownable {
    // A counter to keep track of the next available token ID.
    uint256 private _nextTokenId;

    // Mapping from token ID to its metadata URI.
    mapping(uint256 => string) private _tokenURIs;

    /**
     * @dev Sets the name and symbol for the NFT collection.
     */
    constructor(address initialOwner) ERC721("EventCertificates", "CERT") Ownable(initialOwner) {}

    /**
     * @dev Mints a new certificate NFT and assigns it to a recipient.
     * Can only be called by the contract owner.
     * @param recipient The address that will receive the certificate NFT.
     * @param tokenURI_ The URI pointing to the certificate's metadata on IPFS.
     */
    function mintCertificate(address recipient, string memory tokenURI_) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);
        _tokenURIs[tokenId] = tokenURI_;
    }

    /**
     * @dev Returns the URI for a given token ID.
     * Overrides the base ERC721 function.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // _ownerOf will revert if the token doesn't exist, which is a good check.
        // We also check that the owner is not the zero address.
        require(_ownerOf(tokenId) != address(0), "ERC721: URI query for nonexistent token");
        return _tokenURIs[tokenId];
    }
}