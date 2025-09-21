import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("Certificate", function () {
  let certificate: any;
  let owner: any;
  let recipient: any;
  let otherAccount: any;

  beforeEach(async function () {
    [owner, recipient, otherAccount] = await ethers.getSigners();
    certificate = await ethers.deployContract("Certificate", [owner.address]);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await certificate.owner()).to.equal(owner.address);
    });

    it("Should set the correct name and symbol", async function () {
      expect(await certificate.name()).to.equal("EventCertificates");
      expect(await certificate.symbol()).to.equal("CERT");
    });
  });

  describe("Minting", function () {
    it("Should mint a certificate to recipient", async function () {
      const tokenURI = "https://ipfs.io/ipfs/QmTest123";
      
      await certificate.mintCertificate(recipient.address, tokenURI);
      
      expect(await certificate.ownerOf(0)).to.equal(recipient.address);
      expect(await certificate.tokenURI(0)).to.equal(tokenURI);
      expect(await certificate.balanceOf(recipient.address)).to.equal(1);
    });

    it("Should increment token ID for each mint", async function () {
      const tokenURI1 = "https://ipfs.io/ipfs/QmTest123";
      const tokenURI2 = "https://ipfs.io/ipfs/QmTest456";
      
      await certificate.mintCertificate(recipient.address, tokenURI1);
      await certificate.mintCertificate(otherAccount.address, tokenURI2);
      
      expect(await certificate.ownerOf(0)).to.equal(recipient.address);
      expect(await certificate.ownerOf(1)).to.equal(otherAccount.address);
      expect(await certificate.tokenURI(0)).to.equal(tokenURI1);
      expect(await certificate.tokenURI(1)).to.equal(tokenURI2);
    });

    it("Should only allow owner to mint", async function () {
      const tokenURI = "https://ipfs.io/ipfs/QmTest123";
      
      await expect(
        certificate.connect(recipient).mintCertificate(recipient.address, tokenURI)
      ).to.be.revertedWithCustomError(certificate, "OwnableUnauthorizedAccount");
    });

    it("Should emit Transfer event on mint", async function () {
      const tokenURI = "https://ipfs.io/ipfs/QmTest123";
      
      await expect(certificate.mintCertificate(recipient.address, tokenURI))
        .to.emit(certificate, "Transfer")
        .withArgs(ethers.ZeroAddress, recipient.address, 0);
    });
  });

  describe("Token URI", function () {
    it("Should return correct token URI", async function () {
      const tokenURI = "https://ipfs.io/ipfs/QmTest123";
      
      await certificate.mintCertificate(recipient.address, tokenURI);
      
      expect(await certificate.tokenURI(0)).to.equal(tokenURI);
    });

    it("Should revert for nonexistent token", async function () {
      await expect(certificate.tokenURI(999))
        .to.be.revertedWith("ERC721: URI query for nonexistent token");
    });
  });

  describe("ERC721 Standard", function () {
    beforeEach(async function () {
      const tokenURI = "https://ipfs.io/ipfs/QmTest123";
      await certificate.mintCertificate(recipient.address, tokenURI);
    });

    it("Should support ERC721 interface", async function () {
      expect(await certificate.supportsInterface("0x80ac58cd")).to.be.true; // ERC721
    });

    it("Should allow token transfers", async function () {
      await certificate.connect(recipient).transferFrom(recipient.address, otherAccount.address, 0);
      
      expect(await certificate.ownerOf(0)).to.equal(otherAccount.address);
      expect(await certificate.balanceOf(recipient.address)).to.equal(0);
      expect(await certificate.balanceOf(otherAccount.address)).to.equal(1);
    });

    it("Should allow approval and transferFrom", async function () {
      await certificate.connect(recipient).approve(otherAccount.address, 0);
      await certificate.connect(otherAccount).transferFrom(recipient.address, otherAccount.address, 0);
      
      expect(await certificate.ownerOf(0)).to.equal(otherAccount.address);
    });
  });

  describe("Ownership", function () {
    it("Should allow ownership transfer", async function () {
      await certificate.transferOwnership(otherAccount.address);
      
      expect(await certificate.owner()).to.equal(otherAccount.address);
    });

    it("Should allow new owner to mint", async function () {
      await certificate.transferOwnership(otherAccount.address);
      const tokenURI = "https://ipfs.io/ipfs/QmTest123";
      
      await certificate.connect(otherAccount).mintCertificate(recipient.address, tokenURI);
      
      expect(await certificate.ownerOf(0)).to.equal(recipient.address);
    });
  });
});
