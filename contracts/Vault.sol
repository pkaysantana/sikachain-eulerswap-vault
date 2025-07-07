// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IRateLockOracle.sol";
import "./ClaimManager.sol";
import "./VaultRouterHook.sol"; // Import the hook

contract Vault is IVault, ERC721URIStorage {
    // --- State Variables ---
    struct Deposit {
        address sender;
        address recipient;
        address token;
        uint256 amount;
        uint256 lockedRate;
        uint256 timestamp;
        bool executed;
        bool refunded;
    }

    struct GroupClaimPool {
        address sender;
        address[] recipients;
        uint256[] splits;
        address token;
        uint256 totalAmount;
        uint256 timestamp;
        mapping(address => bool) claimed;
        bool exists;
    }

    IRateLockOracle public rateLockOracle;
    ClaimManager public claimManager;
    VaultRouterHook public vaultRouterHook; // Address of the hook contract

    mapping(bytes32 => Deposit) public deposits;
    mapping(bytes32 => GroupClaimPool) public groupClaimPools;
    mapping(address => uint256) public claimCount;
    mapping(address => uint256) public totalClaimedAmount;
    uint256 public nextSBTId;
    mapping(address => bool) public hasMintedSBT;

    // --- Events ---
    event DepositLocked(
        bytes32 indexed depositId,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 lockedRate
    );
    event ClaimExecuted(bytes32 indexed depositId, address indexed recipient);
    event RefundIssued(bytes32 indexed depositId, address indexed sender);
    event ClaimWithSignature(bytes32 indexed depositId, address indexed recipient, address relayer, string simProof, string code);
    event GroupClaimPoolCreated(bytes32 indexed poolId, address indexed sender, address[] recipients, uint256[] splits, address token, uint256 totalAmount);
    event GroupClaimed(bytes32 indexed poolId, address indexed recipient, uint256 amount);
    event CreditSBTMinted(address indexed recipient, uint256 tokenId, uint256 claimCount, uint256 avgAmount);

    // --- Constructor ---
    constructor(
        address _rateLockOracleAddress,
        address _claimManagerAddress,
        address _vaultRouterHookAddress // Add hook address
    ) ERC721("VaultCreditSBT", "VCSBT") {
        rateLockOracle = IRateLockOracle(_rateLockOracleAddress);
        claimManager = ClaimManager(_claimManagerAddress);
        vaultRouterHook = VaultRouterHook(_vaultRouterHookAddress);
        nextSBTId = 1;
    }

    // --- Admin Function ---
    function setVaultRouterHook(address newHook) external /* onlyOwner or onlyAdmin in production */ {
        vaultRouterHook = VaultRouterHook(newHook);
    }

    // --- Core Functions ---
    function deposit(address recipient, uint256 amount, address token) public override {
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount must be greater than zero");

        // 1. Pull funds from the sender into this vault contract
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // 2. Lock the rate and record the deposit
        uint256 lockedRate = rateLockOracle.getRate(token, address(0));
        require(lockedRate > 0, "Invalid rate from oracle");
        bytes32 depositId = _getDepositId(msg.sender, recipient, token, amount);
        require(deposits[depositId].sender == address(0), "Deposit exists");
        claimManager.recordDeposit(depositId);
        deposits[depositId] = Deposit({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            lockedRate: lockedRate,
            timestamp: block.timestamp,
            executed: false,
            refunded: false
        });

        // 3. Approve the hook and deposit funds to Aave for yield
        IERC20(token).approve(address(vaultRouterHook), amount);
        vaultRouterHook.depositToAave(token, amount);

        // 4. Optionally, trigger smart routing after deposit
        vaultRouterHook.checkAndRouteFunds(token);

        emit DepositLocked(depositId, msg.sender, recipient, token, amount, lockedRate);
    }

    function claim(bytes32 depositId) public override {
        Deposit storage d = deposits[depositId];
        require(d.sender != address(0), "Deposit not found");
        require(msg.sender == d.recipient, "Not authorized");
        require(!d.executed, "Already executed");
        require(!d.refunded, "Already refunded");
        require(claimManager.isClaimable(depositId), "Not claimable");
        vaultRouterHook.onClaimUnwindAndRepay(d.token);
        vaultRouterHook.withdrawFromAave(d.token, d.amount);
        d.executed = true;
        IERC20(d.token).transfer(d.recipient, d.amount);
        claimCount[d.recipient] += 1;
        totalClaimedAmount[d.recipient] += d.amount;
        emit ClaimExecuted(depositId, d.recipient);
    }

    function refund(bytes32 depositId) public override {
        Deposit storage d = deposits[depositId];
        require(d.sender != address(0), "Deposit not found");
        require(msg.sender == d.sender, "Not authorized");
        require(!d.executed, "Already executed");
        require(!d.refunded, "Already refunded");
        require(claimManager.isExpired(depositId), "Not expired");
        
        // 1. Withdraw funds from Aave back to this vault
        vaultRouterHook.withdrawFromAave(d.token, d.amount);

        // 2. Mark as refunded and transfer funds back to sender
        d.refunded = true;
        IERC20(d.token).transfer(d.sender, d.amount);

        emit RefundIssued(depositId, d.sender);
    }

    function claimWithSignature(
        bytes32 depositId,
        string memory simProof,
        string memory code,
        bytes memory signature
    ) public {
        Deposit storage d = deposits[depositId];
        require(d.sender != address(0), "Deposit not found");
        require(!d.executed, "Already executed");
        require(!d.refunded, "Already refunded");
        require(claimManager.isClaimable(depositId), "Not claimable");
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Vault")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Claim(bytes32 depositId,string simProof,string code)"),
                depositId,
                keccak256(bytes(simProof)),
                keccak256(bytes(code))
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = recoverSigner(digest, signature);
        require(signer == d.recipient, "Invalid signature");
        vaultRouterHook.onClaimUnwindAndRepay(d.token);
        vaultRouterHook.withdrawFromAave(d.token, d.amount);
        d.executed = true;
        IERC20(d.token).transfer(d.recipient, d.amount);
        claimCount[d.recipient] += 1;
        totalClaimedAmount[d.recipient] += d.amount;
        emit ClaimExecuted(depositId, d.recipient);
        emit ClaimWithSignature(depositId, d.recipient, msg.sender, simProof, code);
    }

    function createGroupClaimPool(bytes32 poolId, address[] memory recipients, uint256[] memory splits, address token, uint256 totalAmount) public {
        require(recipients.length == splits.length, "Mismatched recipients/splits");
        require(recipients.length > 0, "No recipients");
        require(groupClaimPools[poolId].exists == false, "Pool exists");
        uint256 sum;
        for (uint256 i = 0; i < splits.length; i++) {
            sum += splits[i];
        }
        require(sum == 100, "Splits must sum to 100");
        IERC20(token).transferFrom(msg.sender, address(this), totalAmount);
        GroupClaimPool storage pool = groupClaimPools[poolId];
        pool.sender = msg.sender;
        pool.recipients = recipients;
        pool.splits = splits;
        pool.token = token;
        pool.totalAmount = totalAmount;
        pool.timestamp = block.timestamp;
        pool.exists = true;
        emit GroupClaimPoolCreated(poolId, msg.sender, recipients, splits, token, totalAmount);
    }

    function claimFromGroup(bytes32 poolId) public {
        GroupClaimPool storage pool = groupClaimPools[poolId];
        require(pool.exists, "Pool not found");
        require(!pool.claimed[msg.sender], "Already claimed");
        // Find recipient index and split
        uint256 idx = type(uint256).max;
        for (uint256 i = 0; i < pool.recipients.length; i++) {
            if (pool.recipients[i] == msg.sender) {
                idx = i;
                break;
            }
        }
        require(idx != type(uint256).max, "Not a recipient");
        pool.claimed[msg.sender] = true;
        uint256 amount = pool.totalAmount * pool.splits[idx] / 100;
        IERC20(pool.token).transfer(msg.sender, amount);
        emit GroupClaimed(poolId, msg.sender, amount);
    }

    function mintCreditSBT() public {
        require(claimCount[msg.sender] > 0, "No claims");
        require(!hasMintedSBT[msg.sender], "Already minted");
        uint256 avg = totalClaimedAmount[msg.sender] / claimCount[msg.sender];
        uint256 tokenId = nextSBTId++;
        hasMintedSBT[msg.sender] = true;
        _mint(msg.sender, tokenId);
        string memory uri = string(abi.encodePacked(
            "data:application/json,{\"name\":\"Vault Credit SBT\",\"description\":\"Proof of ",
            uint2str(claimCount[msg.sender]),
            " claims, avg size $",
            uint2str(avg),
            "\"}"
        ));
        _setTokenURI(tokenId, uri);
        emit CreditSBTMinted(msg.sender, tokenId, claimCount[msg.sender], avg);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override {
        require(from == address(0) || to == address(0), "SBT: non-transferable");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function uint2str(uint256 _i) internal pure returns (string memory str) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = _i;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        str = string(bstr);
    }

    // --- View and Internal Functions ---
    function getLockedRate(bytes32 depositId) public view override returns (uint256) {
        return deposits[depositId].lockedRate;
    }

    function _getDepositId(address sender, address recipient, address token, uint256 amount) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                sender,
                recipient,
                token,
                amount,
                block.timestamp
            )
        );
    }
}